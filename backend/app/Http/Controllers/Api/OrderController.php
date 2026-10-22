<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cow;
use App\Models\Order;
use App\Models\Payment;
use App\Support\Presenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    private const WITH = ['cow.breed', 'cow.media', 'buyer', 'seller', 'payment', 'review'];

    public function dashboard(Request $request)
    {
        $u = $request->user();

        return ['data' => [
            'stats' => [
                'cows_listed' => Cow::where('user_id', $u->id)->whereIn('status', ['active', 'paused', 'reserved'])->count(),
                'cows_sold' => Order::where('seller_id', $u->id)->where('status', 'delivered')->count(),
                'purchases' => Order::where('buyer_id', $u->id)->count(),
                'total_sold' => (float) Order::where('seller_id', $u->id)->whereIn('status', ['paid', 'in_transit', 'delivered'])->sum('seller_amount'),
            ],
            'latest_cows' => Cow::with(['breed', 'media'])->where('user_id', $u->id)->latest()->limit(4)->get()
                ->map(fn ($c) => Presenter::cow($c))->all(),
            'latest_deals' => Order::with(self::WITH)->where(fn ($w) => $w->where('buyer_id', $u->id)->orWhere('seller_id', $u->id))
                ->latest()->limit(5)->get()->map(fn ($o) => Presenter::order($o))->all(),
        ]];
    }

    public function checkoutPreview(Request $request, int $cowId)
    {
        $cow = $this->buyableCow($request, $cowId);

        return ['data' => ['cow' => Presenter::cowDetail($cow, $request->user())] + $this->amounts($cow->price) + [
            'payment_methods' => ['pix', 'credit_card', 'boleto'], 'simulated_gateway' => true,
        ]];
    }

    public function checkout(Request $request, int $cowId)
    {
        $data = $request->validate([
            'payment_method' => ['required', 'in:pix,credit_card,boleto'],
            'delivery_method' => ['required', 'in:freight,pickup'],
        ]);
        abort_unless($request->user()->isProfileComplete(), 403, 'Complete seu cadastro (CPF/CNPJ, telefone e cidade) para comprar.');

        $order = DB::transaction(function () use ($request, $cowId, $data) {
            $cow = Cow::with('seller')->lockForUpdate()->findOrFail($cowId);
            abort_unless($cow->status === 'active', 422, 'Este animal não está mais disponível.');
            abort_if($cow->user_id === $request->user()->id, 403, 'Você não pode comprar o seu próprio anúncio.');

            $amounts = $this->amounts($cow->price);
            $order = Order::create([
                'code' => 'BNR-'.strtoupper(Str::random(8)),
                'buyer_id' => $request->user()->id, 'seller_id' => $cow->user_id, 'cow_id' => $cow->id,
                'price' => $amounts['price'], 'commission_percent' => $amounts['commission_percent'],
                'platform_fee' => $amounts['platform_fee'], 'total' => $amounts['total'],
                'seller_amount' => $amounts['seller_amount'], 'delivery_method' => $data['delivery_method'],
            ]);
            // Gateway real (Asaas) entra depois; por ora o pagamento é simulado.
            Payment::create([
                'order_id' => $order->id, 'payer_id' => $request->user()->id, 'gateway' => 'simulated',
                'method' => $data['payment_method'], 'amount' => $amounts['total'],
                'due_date' => now()->addDays(config('boinarede.payment_due_days')),
                'pix_payload' => $data['payment_method'] === 'pix' ? '00020126SIMULADO'.$order->code : null,
            ]);
            $cow->forceFill(['status' => 'reserved'])->save();

            return $order;
        });

        return response()->json(['data' => Presenter::order($this->load($order), true), 'message' => 'Pedido criado!'], 201);
    }

    public function purchases(Request $request)
    {
        return $this->list($request, 'buyer_id');
    }

    public function sales(Request $request)
    {
        return $this->list($request, 'seller_id');
    }

    public function purchase(Request $request, int $id)
    {
        return ['data' => Presenter::order($this->mine($request, $id, 'buyer_id'), true)];
    }

    public function simulatePayment(Request $request, int $id)
    {
        $order = $this->mine($request, $id, 'buyer_id');
        abort_unless($order->status === 'awaiting_payment', 422, 'Este pedido não está aguardando pagamento.');

        DB::transaction(function () use ($order) {
            $order->update(['status' => 'paid', 'paid_at' => now(), 'payout_status' => 'pending']);
            $order->payment?->update(['status' => 'approved', 'paid_at' => now()]);
        });

        return ['data' => Presenter::order($this->load($order), true), 'message' => 'Pagamento aprovado (simulado).'];
    }

    public function ship(Request $request, int $id)
    {
        $order = $this->mine($request, $id, 'seller_id');
        abort_unless($order->status === 'paid', 422, 'O pagamento ainda não foi confirmado.');
        $order->update(['status' => 'in_transit', 'shipped_at' => now()]);

        return ['data' => Presenter::order($this->load($order), true), 'message' => 'Envio registrado.'];
    }

    public function confirmDelivery(Request $request, int $id)
    {
        $order = $this->mine($request, $id, 'buyer_id');
        abort_unless($order->status === 'in_transit', 422, 'O animal ainda não foi enviado.');

        DB::transaction(function () use ($order) {
            $order->update(['status' => 'delivered', 'delivered_at' => now(), 'payout_status' => 'paid', 'payout_at' => now()]);
            $order->cow->forceFill(['status' => 'sold'])->save();
        });

        return ['data' => Presenter::order($this->load($order), true), 'message' => 'Entrega confirmada. Obrigado!'];
    }

    public function review(Request $request, int $id)
    {
        $order = $this->mine($request, $id, 'buyer_id');
        abort_unless($order->status === 'delivered', 422, 'Só é possível avaliar após a entrega.');
        abort_if($order->review, 422, 'Este pedido já foi avaliado.');
        $data = $request->validate(['rating' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:1000']]);

        $order->review()->create($data + ['reviewer_id' => $order->buyer_id, 'seller_id' => $order->seller_id]);

        return ['data' => Presenter::order($this->load($order), true), 'message' => 'Avaliação enviada.'];
    }

    private function list(Request $request, string $column)
    {
        $q = Order::with(self::WITH)->where($column, $request->user()->id)->latest();
        $request->filled('status') && $q->where('status', $request->query('status'));

        return Presenter::page($q->paginate(12), fn ($o) => Presenter::order($o));
    }

    private function mine(Request $request, int $id, string $column): Order
    {
        return Order::with(self::WITH)->where($column, $request->user()->id)->findOrFail($id);
    }

    private function load(Order $order): Order
    {
        return $order->refresh()->load(self::WITH);
    }

    private function buyableCow(Request $request, int $cowId): Cow
    {
        $cow = Cow::with(['breed', 'media', 'seller'])->where('status', 'active')->findOrFail($cowId);
        abort_if($cow->user_id === $request->user()->id, 403, 'Você não pode comprar o seu próprio anúncio.');

        return $cow;
    }

    private function amounts(float $price): array
    {
        $percent = \App\Models\Setting::commission();
        $fee = round($price * $percent / 100, 2);

        return [
            'price' => $price, 'platform_fee' => $fee, 'commission_percent' => $percent,
            'total' => round($price + $fee, 2), 'seller_amount' => $price,
        ];
    }
}

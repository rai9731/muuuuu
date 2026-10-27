<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cow;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Conversation;
use App\Services\Notifier;
use App\Services\Payments\PixPaymentService;
use App\Services\Payments\SimulatedPixGateway;
use App\Support\Presenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    private const WITH = ['cow.breed', 'cow.media', 'buyer', 'seller', 'payment', 'review'];

    private const SIMULATED_CONFIRMED = 'Confirmação SIMULADA (demonstração local): nenhum pagamento real foi feito nem observado no Asaas.';

    private const CHECK_MESSAGES = [
        'confirmed' => 'Pagamento conferido e confirmado.',
        'pending' => 'Ainda não há pagamento registrado para esta cobrança.',
        'divergent' => 'A cobrança consultada não corresponde ao pedido (identificação ou valor). Nada foi confirmado.',
        'inconclusive' => 'Não foi possível concluir a conferência agora. Nada foi confirmado; tente novamente.',
        'not_found' => 'A cobrança não foi localizada. Nada foi confirmado e uma nova cobrança não será criada automaticamente.',
        'preparing' => 'A cobrança ainda não foi criada.',
    ];

    public function __construct(private readonly PixPaymentService $pix) {}

    public function dashboard(Request $request)
    {
        $u = $request->user();

        return ['data' => [
            'stats' => [
                'cows_listed' => Cow::where('user_id', $u->id)->whereIn('status', ['active', 'paused', 'reserved'])->count(),
                'cows_sold' => Order::where('seller_id', $u->id)->where('status', 'delivered')->count(),
                'purchases' => Order::where('buyer_id', $u->id)->count(),
                'total_sold' => (float) Order::where('seller_id', $u->id)->whereIn('status', ['paid', 'in_transit', 'delivered'])->excludingSimulated()->sum('seller_amount'),
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
            'payment_methods' => ['pix'], 'simulated_gateway' => $this->pix->gateway()->source() === 'simulation',
        ]];
    }

    public function checkout(Request $request, int $cowId)
    {
        $data = $request->validate([
            'payment_method' => ['required', 'in:pix'],
            'delivery_method' => ['required', 'in:freight,pickup'],
        ]);
        abort_unless($request->user()->isProfileComplete(), 403, 'Complete seu cadastro (CPF/CNPJ, telefone e cidade) para comprar.');

        $created = false;
        $order = DB::transaction(function () use ($request, $cowId, $data, &$created) {
            $cow = Cow::with('seller')->lockForUpdate()->findOrFail($cowId);
            // Clique repetido / recarga: o mesmo comprador reaproveita o pedido em aberto deste animal.
            $open = Order::where('buyer_id', $request->user()->id)->where('cow_id', $cow->id)->where('status', 'awaiting_payment')->first();
            if ($open) {
                return $open;
            }
            abort_unless($cow->status === 'active', 422, 'Este animal não está mais disponível.');
            abort_if($cow->user_id === $request->user()->id, 403, 'Você não pode comprar o seu próprio anúncio.');

            // Preço e identidade vêm do anúncio no banco; do navegador só vêm as opções de pagamento e entrega.
            $amounts = $this->amounts($cow->price);
            $order = Order::create([
                'code' => 'BNR-'.strtoupper(Str::random(8)),
                'buyer_id' => $request->user()->id, 'seller_id' => $cow->user_id, 'cow_id' => $cow->id,
                'price' => $amounts['price'], 'commission_percent' => $amounts['commission_percent'],
                'platform_fee' => $amounts['platform_fee'], 'total' => $amounts['total'],
                'seller_amount' => $amounts['seller_amount'], 'delivery_method' => $data['delivery_method'],
            ]);
            Payment::create([
                'order_id' => $order->id, 'payer_id' => $request->user()->id,
                'gateway' => $this->pix->gateway()->source() === 'simulation' ? 'simulated' : 'asaas',
                'method' => $data['payment_method'], 'status' => 'preparing', 'amount' => $amounts['total'],
                'due_date' => now()->addDays(config('boinarede.payment_due_days')),
            ]);
            $cow->forceFill(['status' => 'reserved'])->save(); // regra de reserva existente, inalterada
            $created = true;

            return $order;
        });

        if (! $created) {
            return response()->json(['data' => Presenter::order($this->load($order), true), 'message' => 'Você já tem um pedido em andamento para este animal.']);
        }

        // Fora da transação: a chamada ao gateway não segura lock. Resultado incerto fica registrado, sem repetição.
        $this->pix->ensureCharge($order->payment()->firstOrFail());
        Notifier::to($order->seller_id, 'sale_made', 'Você recebeu um pedido', $order->cow->title.' · #'.$order->code, ['order_id' => $order->id]);

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

    /** Só no gateway simulado: registra "o comprador pagou" no gateway. NÃO confirma o pedido; quem confirma é a conferência. */
    public function simulatePayment(Request $request, int $id)
    {
        $order = $this->mine($request, $id, 'buyer_id');
        $gateway = $this->pix->gateway();
        abort_unless($gateway instanceof SimulatedPixGateway, 404);
        abort_unless($order->status === 'awaiting_payment' && $order->payment?->gateway_id, 422, 'Não há cobrança simulada aguardando pagamento.');

        $gateway->markReceived($order->payment->gateway_id);

        return ['data' => Presenter::order($this->load($order), true), 'message' => 'Pagamento simulado no gateway de demonstração. Agora confira o pagamento.'];
    }

    /** Conferência explícita: consulta o gateway e só então pode confirmar (id, referência, valor e status validados). */
    public function checkPayment(Request $request, int $id)
    {
        $order = $this->mine($request, $id, 'buyer_id');
        $result = $this->pix->check($order);
        $simulated = $this->pix->gateway()->source() === 'simulation';

        return [
            'data' => Presenter::order($this->load($order), true),
            'check' => [
                'result' => $result, 'simulated' => $simulated,
                'message' => ($result === 'confirmed' && $simulated) ? self::SIMULATED_CONFIRMED : (self::CHECK_MESSAGES[$result] ?? ''),
            ],
        ];
    }

    public function ship(Request $request, int $id)
    {
        $order = $this->mine($request, $id, 'seller_id');
        abort_unless($order->status === 'paid', 422, 'O pagamento ainda não foi confirmado.');
        $order->update(['status' => 'in_transit', 'shipped_at' => now()]);

        Notifier::to($order->buyer_id, 'order_update', 'Seu animal está a caminho', '#'.$order->code, ['order_id' => $order->id]);

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

        Notifier::to($order->seller_id, 'sale_completed', 'Venda concluída', '#'.$order->code.' · repasse liberado', ['order_id' => $order->id]);
        Notifier::admins('sale_completed', 'Venda concluída', '#'.$order->code, ['order_id' => $order->id]);

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

        // Regra A (decisão do responsável): o comprador paga o preço anunciado; a comissão sai do repasse ao vendedor.
        return [
            'price' => $price, 'platform_fee' => $fee, 'commission_percent' => $percent,
            'total' => round($price, 2), 'seller_amount' => round($price - $fee, 2),
        ];
    }
}

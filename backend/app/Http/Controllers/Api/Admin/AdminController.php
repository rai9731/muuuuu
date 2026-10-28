<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Breed;
use App\Models\Cow;
use App\Models\PasswordResetRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Services\Notifier;
use App\Support\Presenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    private const ORDER_WITH = ['cow.breed', 'cow.media', 'buyer', 'seller', 'payment', 'review'];

    private const PAID = ['paid', 'in_transit', 'delivered'];

    // ─── Dashboard e relatórios ───

    public function dashboard(Request $request)
    {
        $orders = $this->period(Order::query(), $request);
        $paid = (clone $orders)->whereIn('status', self::PAID)->excludingTestPayments(); // simulação e Sandbox não são receita real
        $paidOrders = (clone $paid)->with(['cow.breed', 'seller'])->get();

        return ['data' => [
            'kpis' => [
                'users' => User::where('role', 'user')->count(),
                'cows_listed' => Cow::where('status', 'active')->count(),
                'cows_sold' => (clone $orders)->where('status', 'delivered')->count(),
                'revenue' => (float) $paidOrders->sum('total'),
                'commissions' => (float) $paidOrders->sum('platform_fee'),
                'pending_payments' => (clone $orders)->where('status', 'awaiting_payment')->count(),
                'pending_payments_amount' => (float) (clone $orders)->where('status', 'awaiting_payment')->sum('total'),
                'pending_listings' => Cow::where('status', 'pending')->count(),
            ],
            'sales_by_month' => $this->byMonth($paidOrders)->map(fn ($r) => ['month' => $r['period'], 'label' => $r['label'], 'total' => $r['total'], 'count' => $r['count']])->values(),
            'sales_by_breed' => $this->byBreed($paidOrders),
            'sales_by_state' => $paidOrders->groupBy(fn ($o) => $o->seller->state ?? '—')
                ->map(fn ($g, $s) => ['state' => $s, 'count' => $g->count(), 'total' => (float) $g->sum('total')])->sortByDesc('total')->values(),
            'latest_cows' => Cow::with(['breed', 'media', 'seller'])->latest()->limit(5)->get()->map(fn ($c) => Presenter::cow($c)),
            'latest_payments' => Payment::with(['order.cow', 'order.seller', 'payer'])->latest()->limit(5)->get()->map(fn ($p) => $this->payment($p)),
            'latest_sales' => Order::with(self::ORDER_WITH)->latest()->limit(5)->get()->map(fn ($o) => Presenter::order($o)),
        ]];
    }

    public function reports(Request $request)
    {
        $paid = $this->period(Order::query(), $request)->whereIn('status', self::PAID)->excludingTestPayments()->with(['cow.breed', 'seller'])->get();
        $count = $paid->count();

        return ['data' => [
            'summary' => [
                'revenue' => (float) $paid->sum('total'), 'commissions' => (float) $paid->sum('platform_fee'),
                'sales' => $count, 'average_ticket' => $count ? round($paid->sum('total') / $count, 2) : 0,
            ],
            'by_period' => $this->byMonth($paid)->values(),
            'top_users' => $paid->groupBy('seller_id')->map(fn ($g) => [
                'id' => $g->first()->seller->id, 'name' => $g->first()->seller->name,
                'city' => $g->first()->seller->city, 'state' => $g->first()->seller->state,
                'sales' => $g->count(), 'purchases' => Order::where('buyer_id', $g->first()->seller_id)->count(),
                'listings' => Cow::where('user_id', $g->first()->seller_id)->count(), 'total_sold' => (float) $g->sum('price'),
            ])->sortByDesc('total_sold')->take(10)->values(),
            'top_breeds' => $this->byBreed($paid),
        ]];
    }

    // ─── Anúncios ───

    public function cows(Request $request)
    {
        $q = Cow::with(['breed', 'media', 'seller'])->latest();
        $request->filled('status') && $q->where('status', $request->query('status'));
        if ($s = $request->query('search')) {
            $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhereHas('seller', fn ($u) => $u->where('name', 'like', "%$s%")));
        }

        return Presenter::page($q->paginate(15), fn ($c) => Presenter::cow($c));
    }

    public function cow(int $id)
    {
        return ['data' => Presenter::cowDetail(Cow::with(['breed', 'media', 'seller'])->findOrFail($id))];
    }

    public function approveCow(int $id)
    {
        $cow = Cow::findOrFail($id);
        $cow->forceFill(['status' => 'active', 'rejection_reason' => null, 'published_at' => now()])->save();
        Notifier::to($cow->user_id, 'cow_approved', 'Seu anúncio foi aprovado', $cow->title, ['cow_id' => $cow->id]);

        return ['message' => 'Anúncio aprovado e publicado.'];
    }

    public function rejectCow(Request $request, int $id)
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'max:500']])['reason'];
        $cow = Cow::findOrFail($id);
        $cow->forceFill(['status' => 'rejected', 'rejection_reason' => $reason])->save();
        Notifier::to($cow->user_id, 'cow_rejected', 'Seu anúncio precisa de ajustes', $reason, ['cow_id' => $cow->id]);

        return ['message' => 'Anúncio recusado.'];
    }

    public function pauseCow(int $id)
    {
        $cow = Cow::findOrFail($id);
        abort_unless($cow->status === 'active', 422, 'Só anúncios ativos podem ser pausados.');
        $cow->forceFill(['status' => 'paused'])->save();

        return ['message' => 'Anúncio pausado.'];
    }

    public function deleteCow(int $id)
    {
        $cow = Cow::findOrFail($id);
        abort_if(in_array($cow->status, ['reserved', 'sold']), 422, 'Este anúncio tem uma negociação e não pode ser removido.');
        $cow->delete();

        return ['message' => 'Anúncio removido.'];
    }

    // ─── Usuários ───

    public function users(Request $request)
    {
        $q = User::where('role', 'user')->withCount(['cows'])->latest();
        $request->filled('status') && $q->where('status', $request->query('status'));
        if ($s = $request->query('search')) {
            $q->where(fn ($w) => $w->where('name', 'like', "%$s%")->orWhere('email', 'like', "%$s%"));
        }

        return Presenter::page($q->paginate(15), fn ($u) => $this->userRow($u));
    }

    public function user(int $id)
    {
        $u = User::withCount('cows')->findOrFail($id);

        return ['data' => [
            'user' => $this->userRow($u),
            'cows' => $u->cows()->with(['breed', 'media'])->latest()->limit(20)->get()->map(fn ($c) => Presenter::cow($c)),
            'purchases' => Order::with(self::ORDER_WITH)->where('buyer_id', $u->id)->latest()->limit(20)->get()->map(fn ($o) => Presenter::order($o)),
            'sales' => Order::with(self::ORDER_WITH)->where('seller_id', $u->id)->latest()->limit(20)->get()->map(fn ($o) => Presenter::order($o)),
            'payments' => Payment::with(['order.cow', 'order.seller', 'payer'])->where('payer_id', $u->id)->latest()->limit(20)->get()->map(fn ($p) => $this->payment($p)),
            'password_requests' => PasswordResetRequest::where('user_id', $u->id)->latest()->limit(10)->get()->map(fn ($r) => $this->passwordRequest($r)),
        ]];
    }

    public function blockUser(Request $request, int $id)
    {
        $user = User::where('role', 'user')->findOrFail($id);
        $user->forceFill(['status' => 'blocked'])->save();
        $user->tokens()->delete();

        return ['message' => 'Usuário bloqueado.'];
    }

    public function unblockUser(int $id)
    {
        User::where('role', 'user')->findOrFail($id)->forceFill(['status' => 'active'])->save();

        return ['message' => 'Usuário desbloqueado.'];
    }

    public function resetPassword(Request $request, int $id)
    {
        $data = $request->validate(['password' => ['required', 'string', 'min:6']]);
        $user = User::where('role', 'user')->findOrFail($id);
        $user->forceFill(['password' => $data['password'], 'must_change_password' => true])->save();
        $user->tokens()->delete();
        PasswordResetRequest::where('user_id', $user->id)->where('status', 'pending')
            ->update(['status' => 'resolved', 'resolved_by' => $request->user()->id, 'resolved_at' => now()]);

        return ['message' => 'Senha provisória definida. O usuário deverá trocá-la no próximo acesso.'];
    }

    public function passwordRequests(Request $request)
    {
        $q = PasswordResetRequest::with('user:id,name')->latest();
        $request->filled('status') && $q->where('status', $request->query('status'));

        return Presenter::page($q->paginate(15), fn ($r) => $this->passwordRequest($r));
    }

    private function passwordRequest(PasswordResetRequest $r): array
    {
        return [
            'id' => $r->id, 'email' => $r->email, 'status' => $r->status,
            'user' => $r->user ? ['id' => $r->user->id, 'name' => $r->user->name] : null,
            'created_at' => $r->created_at->toIso8601String(), 'resolved_at' => $r->resolved_at?->toIso8601String(),
        ];
    }

    // ─── Vendas e pagamentos ───

    public function sales(Request $request)
    {
        $q = Order::with(self::ORDER_WITH)->latest();
        $request->filled('status') && $q->where('status', $request->query('status'));
        if ($s = $request->query('search')) {
            $q->where(fn ($w) => $w->where('code', 'like', "%$s%")
                ->orWhereHas('buyer', fn ($u) => $u->where('name', 'like', "%$s%"))
                ->orWhereHas('seller', fn ($u) => $u->where('name', 'like', "%$s%")));
        }

        return Presenter::page($q->paginate(15), fn ($o) => Presenter::order($o));
    }

    public function sale(int $id)
    {
        return ['data' => Presenter::order(Order::with(self::ORDER_WITH)->findOrFail($id), true)];
    }

    public function payments(Request $request)
    {
        $q = Payment::with(['order.cow', 'order.seller', 'payer'])->latest();
        $request->filled('status') && $q->where('status', $request->query('status'));
        $request->filled('method') && $q->where('method', $request->query('method'));

        return Presenter::page($q->paginate(15), fn ($p) => $this->payment($p));
    }

    // ─── Configurações ───

    public function settings()
    {
        return ['data' => $this->settingsPayload()];
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'commission_percent' => ['required', 'numeric', 'min:0', 'max:50'],
            'payment_methods' => ['required', 'array', 'min:1'],
            'payment_methods.*' => ['in:pix,credit_card,boleto'],
            'landing' => ['array'],
            'landing.*' => ['nullable', 'string', 'max:500'],
            'testimonials' => ['array', 'max:12'],
            'testimonials.*.name' => ['required', 'string', 'max:100'],
            'testimonials.*.role' => ['nullable', 'string', 'max:100'],
            'testimonials.*.city' => ['nullable', 'string', 'max:100'],
            'testimonials.*.text' => ['required', 'string', 'max:500'],
        ]);
        foreach ($data as $key => $value) {
            Setting::write($key, $value);
        }

        return ['data' => $this->settingsPayload(), 'message' => 'Configurações salvas.'];
    }

    public function createBreed(Request $request)
    {
        $name = $request->validate(['name' => ['required', 'string', 'max:80']])['name'];
        $breed = Breed::withTrashed()->firstOrNew(['name' => $name]);
        abort_if($breed->exists && ! $breed->trashed(), 422, 'Esta raça já existe.');
        $breed->deleted_at = null;
        $breed->active = true;
        $breed->save();

        return response()->json(['data' => $breed, 'message' => 'Raça criada.'], 201);
    }

    public function updateBreed(Request $request, int $id)
    {
        $data = $request->validate(['name' => ['sometimes', 'string', 'max:80'], 'active' => ['sometimes', 'boolean']]);
        $breed = Breed::findOrFail($id);
        $breed->update($data);

        return ['data' => $breed, 'message' => 'Raça atualizada.'];
    }

    public function deleteBreed(int $id)
    {
        $breed = Breed::findOrFail($id);
        abort_if(Cow::where('breed_id', $id)->exists(), 422, 'Há anúncios usando esta raça. Desative-a em vez de excluir.');
        $breed->delete();

        return ['message' => 'Raça removida.'];
    }

    // ─── Auxiliares ───

    private function period($q, Request $request)
    {
        $request->filled('from') && $q->whereDate('created_at', '>=', $request->query('from'));
        $request->filled('to') && $q->whereDate('created_at', '<=', $request->query('to'));

        return $q;
    }

    private function byMonth($orders)
    {
        return $orders->groupBy(fn ($o) => $o->created_at->format('Y-m'))->sortKeys()->map(fn ($g, $k) => [
            'period' => $k, 'label' => \Carbon\Carbon::createFromFormat('Y-m', $k)->format('m/Y'),
            'total' => (float) $g->sum('total'), 'commissions' => (float) $g->sum('platform_fee'), 'count' => $g->count(),
        ]);
    }

    private function byBreed($orders)
    {
        return $orders->groupBy(fn ($o) => $o->cow->breed->name ?? '—')
            ->map(fn ($g, $b) => ['breed' => $b, 'count' => $g->count(), 'total' => (float) $g->sum('total')])->sortByDesc('total')->values();
    }

    private function userRow(User $u): array
    {
        return Presenter::user($u) + [
            'cows_count' => $u->cows_count ?? $u->cows()->count(),
            'purchases_count' => Order::where('buyer_id', $u->id)->count(),
            'sales_count' => Order::where('seller_id', $u->id)->count(),
        ];
    }

    private function payment(Payment $p): array
    {
        $o = $p->order;

        return (Presenter::payment($p) ?? []) + [
            'order' => ['id' => $o->id, 'code' => $o->code, 'payout_status' => $o->payout_status, 'payout_at' => $o->payout_at?->toIso8601String(), 'seller_amount' => $o->seller_amount, 'status' => $o->status],
            'payer' => ['id' => $p->payer->id, 'name' => $p->payer->name],
            'seller' => ['id' => $o->seller->id, 'name' => $o->seller->name],
            'cow' => ['id' => $o->cow->id, 'title' => $o->cow->title],
        ];
    }

    private function settingsPayload(): array
    {
        return [
            'commission_percent' => Setting::commission(),
            'payment_methods' => Setting::read('payment_methods', ['pix', 'credit_card', 'boleto']),
            'landing' => (object) Setting::read('landing', []),
            'testimonials' => Setting::read('testimonials', []),
            'breeds' => Breed::withCount('cows')->orderBy('name')->get(['id', 'name', 'active']),
        ];
    }
}

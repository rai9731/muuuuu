<?php

namespace App\Support;

use App\Models\Cow;
use App\Models\CowMedia;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Storage;

/** Formata os models no contrato JSON que o frontend espera (services/types.ts). */
class Presenter
{
    public static function page(LengthAwarePaginator $p, callable $map): array
    {
        return [
            'data' => $p->getCollection()->map($map)->values()->all(),
            'meta' => [
                'current_page' => $p->currentPage(), 'last_page' => $p->lastPage(),
                'per_page' => $p->perPage(), 'total' => $p->total(),
            ],
        ];
    }

    public static function url(?string $path): ?string
    {
        return $path ? Storage::disk('public')->url($path) : null;
    }

    public static function user(User $u): array
    {
        return [
            'id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->role, 'status' => $u->status,
            'avatar_url' => self::url($u->avatar_path), 'phone' => $u->phone,
            'document' => Document::format($u->document), 'city' => $u->city, 'state' => $u->state,
            'farm_name' => $u->farm_name, 'farm_description' => $u->farm_description,
            'has_password' => filled($u->password), 'has_google' => filled($u->google_id),
            'profile_complete' => $u->isProfileComplete(), 'must_change_password' => $u->must_change_password,
            'payout_pix_key' => $u->payout_pix_key, 'payout_pix_key_type' => $u->payout_pix_key_type,
            'payout_bank' => $u->payout_bank, 'notification_preferences' => $u->notification_preferences ?? [],
            'created_at' => $u->created_at->toIso8601String(),
        ];
    }

    public static function person(User $u): array
    {
        return [
            'id' => $u->id, 'name' => $u->name, 'avatar_url' => self::url($u->avatar_path),
            'city' => $u->city, 'state' => $u->state, 'phone' => $u->phone,
        ];
    }

    public static function seller(User $u): array
    {
        $ratings = \App\Models\Review::where('seller_id', $u->id);

        return [
            'id' => $u->id, 'name' => $u->name, 'avatar_url' => self::url($u->avatar_path),
            'city' => $u->city, 'state' => $u->state, 'farm_name' => $u->farm_name,
            'rating' => $ratings->count() ? round((float) $ratings->avg('rating'), 1) : null,
            'reviews_count' => $ratings->count(), 'member_since' => $u->created_at->toIso8601String(),
        ];
    }

    public static function media(CowMedia $m): array
    {
        return [
            'id' => $m->id, 'type' => $m->type, 'url' => self::url($m->path),
            'thumb_url' => self::url($m->thumb_path ?? $m->path),
            'original_name' => $m->original_name, 'size' => (int) $m->size,
        ];
    }

    public static function cow(Cow $c, ?User $viewer = null): array
    {
        $cover = $c->media->firstWhere('type', 'photo');
        $data = [
            'id' => $c->id, 'title' => $c->title, 'breed' => $c->breed ? ['id' => $c->breed->id, 'name' => $c->breed->name] : null,
            'sex' => $c->sex, 'age_months' => $c->age_months, 'weight_kg' => $c->weight_kg, 'purpose' => $c->purpose,
            'price' => $c->price, 'city' => $c->city, 'state' => $c->state, 'status' => $c->status,
            'verified' => $c->verified, 'views_count' => $c->views_count,
            'cover_url' => self::url($cover?->path), 'cover_thumb_url' => self::url($cover?->thumb_path ?? $cover?->path),
            'rejection_reason' => $c->rejection_reason,
            'created_at' => $c->created_at->toIso8601String(), 'published_at' => $c->published_at?->toIso8601String(),
        ];
        if ($c->relationLoaded('seller') && $c->seller) {
            $data['seller'] = self::seller($c->seller);
        }
        if ($viewer) {
            $data['is_favorite'] = \App\Models\Favorite::where('user_id', $viewer->id)->where('cow_id', $c->id)->exists();
        }

        return $data;
    }

    public static function cowDetail(Cow $c, ?User $viewer = null): array
    {
        return self::cow($c, $viewer) + [
            'description' => $c->description, 'milk_production_liters' => $c->milk_production_liters,
            'vaccinations' => $c->vaccinations ?? [], 'vaccinated' => $c->vaccinated,
            'is_pregnant' => $c->is_pregnant, 'pregnancy_months' => $c->pregnancy_months,
            'health_history' => $c->health_history,
            'photos' => $c->media->where('type', 'photo')->map(fn ($m) => self::media($m))->values()->all(),
            'video' => ($v = $c->media->firstWhere('type', 'video')) ? self::media($v) : null,
            'certificates' => $c->media->where('type', 'certificate')->map(fn ($m) => self::media($m))->values()->all(),
            'is_owner' => $viewer?->id === $c->user_id,
        ];
    }

    public static function payment(?Payment $p): ?array
    {
        if (! $p) {
            return null;
        }

        return [
            'id' => $p->id, 'method' => $p->method, 'status' => $p->status, 'amount' => $p->amount,
            'due_date' => $p->due_date?->toDateString(),
            // Pix só é exibido enquanto a cobrança existe e aguarda pagamento (sempre a cobrança deste pedido).
            'pix_payload' => $p->status === 'pending' ? $p->pix_payload : null,
            'pix_qr_image' => $p->status === 'pending' ? $p->pix_qr_image : null,
            'gateway_status' => $p->gateway_status, 'last_check_result' => $p->last_check_result,
            'last_checked_at' => $p->last_checked_at?->toIso8601String(), 'confirmation_source' => $p->confirmation_source, 'boleto_url' => $p->boleto_url, 'invoice_url' => $p->invoice_url,
            'paid_at' => $p->paid_at?->toIso8601String(), 'refunded_at' => $p->refunded_at?->toIso8601String(),
            'simulated' => $p->gateway === 'simulated', 'created_at' => $p->created_at->toIso8601String(),
        ];
    }

    /** Etapas da jornada de pagamento Pix, derivadas só do que está gravado (sem afirmar o que não foi conferido). */
    public static function journey(Order $o): array
    {
        $p = $o->payment;
        $paid = $p?->status === 'approved';
        $st = $p?->status;
        $step = fn (string $key, string $label, string $state, ?string $note = null) => compact('key', 'label', 'state', 'note');

        $charge = match (true) {
            $paid || $p?->gateway_id !== null => $step('charge', 'Cobrança criada', 'done'),
            $st === 'uncertain' => $step('charge', 'Cobrança: resultado incerto', 'warning', 'Não sabemos se a cobrança foi criada. Confira antes de qualquer nova tentativa.'),
            $st === 'divergent' => $step('charge', 'Cobrança divergente', 'warning', 'A cobrança encontrada não corresponde ao pedido.'),
            default => $step('charge', 'Cobrança preparada', 'current', 'A cobrança ainda não foi criada.'),
        };
        $awaiting = match (true) {
            $paid => $step('awaiting', 'Aguardando pagamento', 'done'),
            $st === 'pending' => $step('awaiting', 'Aguardando pagamento', 'current', 'Use o Pix abaixo e depois clique em "Conferir pagamento".'),
            $st === 'divergent' && $p->gateway_id => $step('awaiting', 'Aguardando pagamento', 'warning', 'Divergência na última conferência; nada foi confirmado.'),
            default => $step('awaiting', 'Aguardando pagamento', 'todo'),
        };
        $note = $paid ? ($p->confirmation_source === 'simulation' ? 'Confirmação SIMULADA (gateway de demonstração), não é pagamento real.' : 'Confirmado pelo gateway após validação de cobrança, pedido e valor.') : null;

        return [
            $step('order', 'Venda registrada', 'done', '#'.$o->code),
            $charge,
            $awaiting,
            $step('checking', 'Conferindo pagamento', $paid ? 'done' : 'todo', $paid ? null : 'Acontece quando você clica em "Conferir pagamento".'),
            $step('confirmed', 'Pagamento confirmado', $paid ? 'done' : 'todo', $note),
        ];
    }

    public static function order(Order $o, bool $detail = false): array
    {
        $data = [
            'id' => $o->id, 'code' => $o->code, 'status' => $o->status, 'delivery_method' => $o->delivery_method,
            'price' => $o->price, 'platform_fee' => $o->platform_fee, 'commission_percent' => $o->commission_percent,
            'total' => $o->total, 'seller_amount' => $o->seller_amount, 'payout_status' => $o->payout_status,
            'payout_at' => $o->payout_at?->toIso8601String(), 'paid_at' => $o->paid_at?->toIso8601String(),
            'shipped_at' => $o->shipped_at?->toIso8601String(), 'delivered_at' => $o->delivered_at?->toIso8601String(),
            'cancelled_at' => $o->cancelled_at?->toIso8601String(), 'created_at' => $o->created_at->toIso8601String(),
            'cow' => self::cow($o->cow), 'buyer' => self::person($o->buyer), 'seller' => self::person($o->seller),
            'payment' => self::payment($o->payment),
            'review' => $o->review ? ['rating' => $o->review->rating, 'comment' => $o->review->comment, 'created_at' => $o->review->created_at->toIso8601String()] : null,
            'conversation_id' => \App\Models\Conversation::where('cow_id', $o->cow_id)->where('buyer_id', $o->buyer_id)->value('id'),
        ];
        if ($detail) {
            $step = fn (string $s, string $label, $date, bool $done) => ['status' => $s, 'label' => $label, 'date' => $date?->toIso8601String(), 'done' => $done];
            $data['journey'] = self::journey($o);
            $data['timeline'] = [
                $step('created', 'Pedido criado', $o->created_at, true),
                $step('paid', 'Pagamento confirmado', $o->paid_at, $o->paid_at !== null),
                $step('in_transit', 'Animal enviado', $o->shipped_at, $o->shipped_at !== null),
                $step('delivered', 'Entrega confirmada', $o->delivered_at, $o->delivered_at !== null),
            ];
        }

        return $data;
    }
}

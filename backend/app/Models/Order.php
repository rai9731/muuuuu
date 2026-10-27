<?php

namespace App\Models;

use App\Models\Concerns\SerializesLocalDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use SerializesLocalDates, SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'price' => 'float', 'platform_fee' => 'float', 'total' => 'float',
            'seller_amount' => 'float', 'commission_percent' => 'float',
            'paid_at' => 'datetime', 'shipped_at' => 'datetime', 'delivered_at' => 'datetime',
            'cancelled_at' => 'datetime', 'payout_at' => 'datetime',
        ];
    }

    /** Pedidos cujo pagamento NÃO é de gateway simulado (receita/comissão reais). */
    public function scopeExcludingSimulated($query)
    {
        return $query->whereDoesntHave('payment', fn ($p) => $p->where('gateway', 'simulated'));
    }

    public function cow()
    {
        return $this->belongsTo(Cow::class)->withTrashed();
    }

    public function buyer()
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function payment()
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    public function review()
    {
        return $this->hasOne(Review::class);
    }
}

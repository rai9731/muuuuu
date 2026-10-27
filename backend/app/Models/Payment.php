<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['amount' => 'float', 'due_date' => 'date', 'paid_at' => 'datetime', 'refunded_at' => 'datetime', 'last_checked_at' => 'datetime'];
    }

    // Relações usadas pelo painel admin (AdminController::payment); ausentes antes: o painel dava 500 com qualquer pagamento.
    public function order()
    {
        return $this->belongsTo(Order::class)->withTrashed();
    }

    public function payer()
    {
        return $this->belongsTo(User::class, 'payer_id')->withTrashed();
    }
}

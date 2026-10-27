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
}

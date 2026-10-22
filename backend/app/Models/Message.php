<?php

namespace App\Models;

use App\Models\Concerns\SerializesLocalDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use SerializesLocalDates, SoftDeletes;

    protected $guarded = ['id'];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }
}

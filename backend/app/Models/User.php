<?php

namespace App\Models;

use App\Models\Concerns\SerializesLocalDates;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SerializesLocalDates, SoftDeletes;

    protected $guarded = ['id', 'role', 'status'];

    protected $hidden = ['password', 'remember_token', 'document', 'document_hash', 'payout_pix_key', 'payout_bank'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'document' => 'encrypted',
            'payout_pix_key' => 'encrypted',
            'payout_bank' => 'encrypted:array',
            'notification_preferences' => 'array',
            'must_change_password' => 'boolean',
            'terms_accepted_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function cows()
    {
        return $this->hasMany(Cow::class);
    }

    public function isProfileComplete(): bool
    {
        return filled($this->document) && filled($this->phone) && filled($this->city) && filled($this->state);
    }
}

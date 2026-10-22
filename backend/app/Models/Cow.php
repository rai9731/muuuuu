<?php

namespace App\Models;

use App\Models\Concerns\SerializesLocalDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cow extends Model
{
    use SerializesLocalDates, SoftDeletes;

    protected $guarded = ['id', 'user_id', 'status', 'verified', 'views_count', 'published_at'];

    protected function casts(): array
    {
        return [
            'vaccinated' => 'boolean',
            'is_pregnant' => 'boolean',
            'verified' => 'boolean',
            'vaccinations' => 'array',
            'price' => 'float',
            'weight_kg' => 'float',
            'milk_production_liters' => 'float',
            'published_at' => 'datetime',
        ];
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function breed()
    {
        return $this->belongsTo(Breed::class);
    }

    public function media()
    {
        return $this->hasMany(CowMedia::class)->orderBy('position');
    }
}

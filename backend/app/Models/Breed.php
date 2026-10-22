<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Breed extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    public function cows()
    {
        return $this->hasMany(Cow::class);
    }

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}

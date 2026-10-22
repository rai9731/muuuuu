<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Setting extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    public static function read(string $key, mixed $default = null): mixed
    {
        $row = static::where('key', $key)->first();

        return $row && $row->value !== null ? $row->value['v'] ?? $default : $default;
    }

    public static function write(string $key, mixed $value): void
    {
        $row = static::withTrashed()->firstOrNew(['key' => $key]);
        $row->deleted_at = null;
        $row->value = ['v' => $value];
        $row->save();
    }

    public static function commission(): float
    {
        return (float) static::read('commission_percent', config('boinarede.commission_percent'));
    }
}

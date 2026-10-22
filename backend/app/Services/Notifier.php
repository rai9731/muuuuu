<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;

/** Cria notificações internas respeitando as preferências do usuário. */
class Notifier
{
    public static function to(User|int|null $user, string $type, string $title, ?string $body = null, array $data = []): void
    {
        $user = is_int($user) ? User::find($user) : $user;
        if (! $user || $user->status !== 'active') {
            return;
        }
        // Preferência desligada = não notifica (padrão: ligado). Admin recebe tudo.
        if ($user->role !== 'admin' && ($user->notification_preferences[$type] ?? true) === false) {
            return;
        }

        AppNotification::create([
            'user_id' => $user->id, 'type' => $type, 'title' => $title,
            'body' => $body ? mb_substr($body, 0, 500) : null, 'data' => $data,
        ]);
    }

    public static function admins(string $type, string $title, ?string $body = null, array $data = []): void
    {
        User::where('role', 'admin')->get()->each(fn ($a) => self::to($a, $type, $title, $body, $data));
    }
}

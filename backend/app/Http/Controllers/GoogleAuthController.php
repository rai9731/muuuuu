<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Notifier;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public static function enabled(): bool
    {
        $id = (string) config('services.google.client_id');

        return $id !== '' && ! str_starts_with($id, 'COLE_AQUI') && filled(config('services.google.client_secret'));
    }

    public function redirect()
    {
        if (! self::enabled()) {
            return redirect($this->front('/entrar?erro=google_disabled'));
        }

        return Socialite::driver('google')->stateless()->redirect();
    }

    public function callback()
    {
        if (! self::enabled()) {
            return redirect($this->front('/entrar?erro=google_disabled'));
        }

        try {
            $g = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $e) {
            Log::warning('Falha no login com Google: '.$e->getMessage());

            return redirect($this->front('/entrar?erro=google_failed'));
        }

        $user = User::where('google_id', $g->getId())->first()
            ?? User::where('email', $g->getEmail())->first();

        if ($user && $user->status !== 'active') {
            return redirect($this->front('/entrar?erro=google_failed'));
        }

        if (! $user) {
            $user = User::create([
                'name' => $g->getName() ?: $g->getEmail(), 'email' => $g->getEmail(),
                'google_id' => $g->getId(), 'terms_accepted_at' => now(),
            ]);
            Notifier::admins('new_user', 'Novo usuário cadastrado', $user->name, ['user_id' => $user->id]);
        } elseif (! $user->google_id) {
            $user->forceFill(['google_id' => $g->getId()]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('web', ['*'], now()->addMinutes(config('boinarede.session_lifetime_minutes')))->plainTextToken;

        return redirect($this->front('/entrar/google#token='.urlencode($token)));
    }

    private function front(string $path): string
    {
        return config('boinarede.frontend_url').$path;
    }
}

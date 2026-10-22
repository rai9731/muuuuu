<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Rules\ValidDocument;
use App\Support\Document;
use App\Support\Presenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'document' => ['required', 'string', new ValidDocument],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:20'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'size:2'],
            'farm_name' => ['nullable', 'string', 'max:150'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'terms' => ['accepted'],
        ]);

        $hash = Document::hash($data['document']);
        if (User::where('document_hash', $hash)->exists()) {
            throw ValidationException::withMessages(['document' => 'Este CPF/CNPJ já está cadastrado.']);
        }

        $user = User::create([
            ...collect($data)->except(['terms', 'password_confirmation'])->all(),
            'document' => Document::digits($data['document']),
            'document_hash' => $hash,
            'state' => strtoupper($data['state']),
            'terms_accepted_at' => now(),
            'last_login_at' => now(),
        ]);

        return response()->json(['token' => $this->token($user, true), 'user' => Presenter::user($user)], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $user = User::where('email', $data['email'])->first();
        if (! $user || ! $user->password || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'E-mail ou senha incorretos.']);
        }
        if ($user->status !== 'active') {
            return response()->json(['message' => 'Sua conta está bloqueada. Entre em contato com o suporte.'], 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'token' => $this->token($user, (bool) ($data['remember'] ?? false)),
            'user' => Presenter::user($user),
        ]);
    }

    public function me(Request $request)
    {
        return ['data' => Presenter::user($request->user())];
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function token(User $user, bool $remember): string
    {
        $minutes = $remember ? config('boinarede.remember_me_days') * 1440 : config('boinarede.session_lifetime_minutes');

        return $user->createToken('web', ['*'], now()->addMinutes($minutes))->plainTextToken;
    }
}

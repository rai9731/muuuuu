<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Rules\ValidDocument;
use App\Support\Document;
use App\Support\Presenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'document' => ['sometimes', 'required', 'string', new ValidDocument],
            'phone' => ['sometimes', 'required', 'string', 'max:20'],
            'city' => ['sometimes', 'required', 'string', 'max:120'],
            'state' => ['sometimes', 'required', 'string', 'size:2'],
            'farm_name' => ['nullable', 'string', 'max:150'],
            'farm_description' => ['nullable', 'string', 'max:2000'],
        ]);

        if (isset($data['document'])) {
            $hash = Document::hash($data['document']);
            if (\App\Models\User::where('document_hash', $hash)->where('id', '!=', $user->id)->exists()) {
                throw ValidationException::withMessages(['document' => 'Este CPF/CNPJ já está cadastrado.']);
            }
            $data['document'] = Document::digits($data['document']);
            $data['document_hash'] = $hash;
        }
        isset($data['state']) && $data['state'] = strtoupper($data['state']);

        $user->update($data);

        return ['data' => Presenter::user($user->refresh()), 'message' => 'Perfil atualizado.'];
    }

    public function avatar(Request $request)
    {
        $request->validate(['avatar' => ['required', 'image', 'max:5120']]);
        $user = $request->user();
        $old = $user->avatar_path;
        $user->update(['avatar_path' => $request->file('avatar')->store("avatars/{$user->id}", 'public')]);
        $old && Storage::disk('public')->delete($old);

        return ['data' => Presenter::user($user->refresh()), 'message' => 'Foto atualizada.'];
    }

    public function payout(Request $request)
    {
        $data = $request->validate([
            'payout_pix_key_type' => ['nullable', 'in:cpf,cnpj,email,phone,random'],
            'payout_pix_key' => ['nullable', 'string', 'max:140'],
            'bank' => ['nullable', 'string', 'max:80'],
            'agency' => ['nullable', 'string', 'max:20'],
            'account' => ['nullable', 'string', 'max:30'],
            'account_type' => ['nullable', 'in:corrente,poupanca'],
            'holder' => ['nullable', 'string', 'max:150'],
        ]);
        $bank = collect($data)->only(['bank', 'agency', 'account', 'account_type', 'holder'])->filter()->all();
        abort_if(blank($data['payout_pix_key'] ?? null) && ! $bank, 422, 'Informe uma chave Pix ou os dados da conta bancária.');

        $request->user()->update([
            'payout_pix_key_type' => $data['payout_pix_key_type'] ?? null,
            'payout_pix_key' => $data['payout_pix_key'] ?? null,
            'payout_bank' => $bank ?: null,
        ]);

        return ['data' => Presenter::user($request->user()->refresh()), 'message' => 'Dados de recebimento salvos.'];
    }

    public function preferences(Request $request)
    {
        $prefs = $request->validate(['preferences' => ['required', 'array'], 'preferences.*' => ['boolean']])['preferences'];
        $request->user()->update(['notification_preferences' => $prefs]);

        return ['data' => Presenter::user($request->user()->refresh()), 'message' => 'Preferências salvas.'];
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => [$user->must_change_password || ! $user->password ? 'nullable' : 'required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);
        if (! $user->must_change_password && $user->password && ! Hash::check($data['current_password'] ?? '', $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Senha atual incorreta.']);
        }
        $user->update(['password' => $data['password'], 'must_change_password' => false]);

        return ['data' => Presenter::user($user->refresh()), 'message' => 'Senha alterada.'];
    }

    /** LGPD: cópia dos dados pessoais. */
    public function export(Request $request)
    {
        $user = $request->user();
        $payload = [
            'usuario' => Presenter::user($user),
            'anuncios' => $user->cows()->get()->map(fn ($c) => $c->only(['id', 'title', 'price', 'status', 'created_at']))->all(),
            'pedidos' => Order::where('buyer_id', $user->id)->orWhere('seller_id', $user->id)->get()->map(fn ($o) => $o->only(['code', 'status', 'total', 'created_at']))->all(),
        ];

        return response()->json($payload, 200, ['Content-Disposition' => 'attachment; filename="meus-dados-boi-na-rede.json"']);
    }

    /** LGPD: anonimiza e remove a conta. */
    public function destroy(Request $request)
    {
        $user = $request->user();
        $request->validate(['password' => [$user->password ? 'required' : 'nullable', 'string']]);
        if ($user->password && ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['password' => 'Senha incorreta.']);
        }
        abort_if($user->role === 'admin', 403, 'Administradores não podem excluir a própria conta.');
        abort_if(Order::where(fn ($w) => $w->where('buyer_id', $user->id)->orWhere('seller_id', $user->id))
            ->whereIn('status', ['awaiting_payment', 'paid', 'in_transit'])->exists(), 422, 'Você tem pedidos em andamento. Conclua-os antes de excluir a conta.');

        $user->cows()->whereIn('status', ['active', 'paused', 'pending'])->each->delete();
        $user->tokens()->delete();
        $user->forceFill([
            'name' => 'Usuário removido', 'email' => "removido-{$user->id}@anonimo.invalid", 'password' => null,
            'document' => null, 'document_hash' => null, 'phone' => null, 'city' => null, 'farm_name' => null,
            'farm_description' => null, 'avatar_path' => null, 'google_id' => null,
            'payout_pix_key' => null, 'payout_bank' => null, 'status' => 'blocked',
        ])->save();
        $user->delete();

        return ['message' => 'Conta excluída.'];
    }
}

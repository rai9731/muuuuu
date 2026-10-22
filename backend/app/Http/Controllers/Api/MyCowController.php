<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cow;
use App\Models\CowMedia;
use App\Services\Notifier;
use App\Support\Presenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MyCowController extends Controller
{
    public function index(Request $request)
    {
        $q = Cow::with(['breed', 'media'])->where('user_id', $request->user()->id)->latest();
        $request->filled('status') && $q->where('status', $request->query('status'));

        return Presenter::page($q->paginate(12), fn ($c) => Presenter::cow($c));
    }

    public function show(Request $request, int $id)
    {
        return ['data' => Presenter::cowDetail($this->own($request, $id), $request->user())];
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $cow = $request->user()->cows()->make($data);
        $cow->forceFill(['status' => 'pending'])->save();
        $this->saveMedia($request, $cow);
        Notifier::admins('new_cow', 'Novo anúncio para análise', $cow->title, ['cow_id' => $cow->id, 'image_url' => Presenter::url($cow->media()->where('type', 'photo')->first()?->path)]);

        return response()->json(['data' => Presenter::cowDetail($this->fresh($cow), $request->user()), 'message' => 'Anúncio enviado para análise. Você será avisado quando for publicado.'], 201);
    }

    public function update(Request $request, int $id)
    {
        $cow = $this->own($request, $id);
        abort_if($cow->status === 'sold', 403, 'Anúncios vendidos não podem ser editados.');

        $cow->update($this->validated($request));
        foreach ((array) $request->input('remove_media_ids', []) as $mediaId) {
            $cow->media()->whereKey($mediaId)->first()?->delete();
        }
        $this->saveMedia($request, $cow);

        return ['data' => Presenter::cowDetail($this->fresh($cow), $request->user()), 'message' => 'Anúncio atualizado.'];
    }

    public function status(Request $request, int $id)
    {
        $cow = $this->own($request, $id);
        $action = $request->validate(['action' => ['required', 'in:pause,resume,sold']])['action'];

        $new = match ($action) {
            'pause' => $cow->status === 'active' ? 'paused' : null,
            'resume' => $cow->status === 'paused' ? 'active' : null,
            'sold' => in_array($cow->status, ['active', 'paused']) ? 'sold' : null,
        };
        abort_if($new === null, 422, 'Ação indisponível para o status atual do anúncio.');
        $cow->forceFill(['status' => $new])->save();

        return ['data' => Presenter::cow($this->fresh($cow)), 'message' => 'Status atualizado.'];
    }

    public function destroy(Request $request, int $id)
    {
        $cow = $this->own($request, $id);
        abort_if($cow->status === 'reserved' || $cow->status === 'sold', 422, 'Este anúncio tem uma negociação e não pode ser removido.');
        $cow->delete();

        return ['message' => 'Anúncio removido.'];
    }

    private function own(Request $request, int $id): Cow
    {
        return Cow::with(['breed', 'media'])->where('user_id', $request->user()->id)->findOrFail($id);
    }

    private function fresh(Cow $cow): Cow
    {
        return $cow->load(['breed', 'media', 'seller'])->refresh()->load(['breed', 'media', 'seller']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'breed_id' => ['required', 'exists:breeds,id'],
            'sex' => ['required', 'in:femea,macho'],
            'age_months' => ['required', 'integer', 'min:0', 'max:400'],
            'weight_kg' => ['required', 'numeric', 'min:1', 'max:2000'],
            'purpose' => ['required', 'in:leite,corte,reproducao'],
            'milk_production_liters' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:5000'],
            'vaccinated' => ['boolean'],
            'vaccinations' => ['array'],
            'vaccinations.*' => ['string', 'max:80'],
            'is_pregnant' => ['boolean'],
            'pregnancy_months' => ['nullable', 'integer', 'min:1', 'max:10'],
            'health_history' => ['nullable', 'string', 'max:5000'],
            'price' => ['required', 'numeric', 'min:1'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'size:2'],
            'photos' => ['array', 'max:10'],
            'photos.*' => ['image', 'max:'.(config('boinarede.uploads.max_size_mb') * 1024)],
            'video' => ['nullable', 'file', 'mimes:mp4', 'max:'.(config('boinarede.uploads.max_size_mb') * 1024)],
            'certificates' => ['array', 'max:5'],
            'certificates.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:'.(config('boinarede.uploads.max_size_mb') * 1024)],
        ]);

        $data['state'] = strtoupper($data['state']);
        $data['vaccinations'] = $data['vaccinations'] ?? [];
        if (! ($data['is_pregnant'] ?? false)) {
            $data['pregnancy_months'] = null;
        }

        return collect($data)->except(['photos', 'video', 'certificates'])->all();
    }

    private function saveMedia(Request $request, Cow $cow): void
    {
        $position = (int) $cow->media()->max('position');
        $store = function ($file, string $type) use ($cow, &$position) {
            CowMedia::create([
                'cow_id' => $cow->id, 'type' => $type, 'path' => $file->store("cows/{$cow->id}", 'public'),
                'original_name' => $file->getClientOriginalName(), 'mime' => $file->getMimeType(),
                'size' => $file->getSize(), 'position' => ++$position,
            ]);
        };

        foreach ($request->file('photos', []) as $f) {
            $store($f, 'photo');
        }
        foreach ($request->file('certificates', []) as $f) {
            $store($f, 'certificate');
        }
        if ($video = $request->file('video')) {
            $cow->media()->where('type', 'video')->get()->each->delete();
            $store($video, 'video');
        }
    }
}

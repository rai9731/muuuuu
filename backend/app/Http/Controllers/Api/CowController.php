<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cow;
use App\Models\Favorite;
use App\Support\Presenter;
use Illuminate\Http\Request;

class CowController extends Controller
{
    private const WITH = ['breed', 'media', 'seller'];

    public function index(Request $request)
    {
        $q = Cow::with(self::WITH)->where('status', 'active');

        if ($s = $request->query('search')) {
            $q->where(fn ($w) => $w->where('title', 'like', "%$s%")->orWhere('description', 'like', "%$s%"));
        }
        foreach (['breed_id', 'purpose', 'state'] as $f) {
            $request->filled($f) && $q->where($f, $request->query($f));
        }
        $request->filled('city') && $q->where('city', 'like', '%'.$request->query('city').'%');
        $request->filled('pregnant') && $q->where('is_pregnant', filter_var($request->query('pregnant'), FILTER_VALIDATE_BOOL));
        foreach (['price' => 'price', 'age' => 'age_months', 'weight' => 'weight_kg'] as $key => $col) {
            $request->filled("{$key}_min") && $q->where($col, '>=', $request->query("{$key}_min"));
            $request->filled("{$key}_max") && $q->where($col, '<=', $request->query("{$key}_max"));
        }

        match ($request->query('sort')) {
            'price_asc' => $q->orderBy('price'),
            'price_desc' => $q->orderByDesc('price'),
            'age_asc' => $q->orderBy('age_months'),
            default => $q->latest('published_at'),
        };

        $viewer = auth('sanctum')->user();

        return Presenter::page($q->paginate(12), fn ($c) => Presenter::cow($c, $viewer));
    }

    public function show(int $id)
    {
        $viewer = auth('sanctum')->user();
        $cow = Cow::with(self::WITH)->findOrFail($id);

        // Só o dono vê anúncios que não estão na vitrine
        if (! in_array($cow->status, ['active', 'reserved', 'sold']) && $viewer?->id !== $cow->user_id) {
            abort(404);
        }
        if ($viewer?->id !== $cow->user_id) {
            $cow->increment('views_count');
        }

        $similar = Cow::with(self::WITH)->where('status', 'active')->where('id', '!=', $cow->id)
            ->where(fn ($w) => $w->where('breed_id', $cow->breed_id)->orWhere('purpose', $cow->purpose))
            ->latest('published_at')->limit(4)->get();

        return [
            'data' => Presenter::cowDetail($cow, $viewer),
            'similar' => $similar->map(fn ($c) => Presenter::cow($c, $viewer))->all(),
        ];
    }

    public function toggleFavorite(Request $request, int $id)
    {
        $cow = Cow::where('status', 'active')->findOrFail($id);
        $fav = Favorite::withTrashed()->firstOrNew(['user_id' => $request->user()->id, 'cow_id' => $cow->id]);

        if ($fav->exists && ! $fav->trashed()) {
            $fav->delete();

            return ['favorite' => false];
        }
        $fav->deleted_at = null;
        $fav->save();

        return ['favorite' => true];
    }

    public function favorites(Request $request)
    {
        $user = $request->user();
        $q = Cow::with(self::WITH)->whereIn('id', Favorite::where('user_id', $user->id)->select('cow_id'))->latest();

        return Presenter::page($q->paginate(12), fn ($c) => Presenter::cow($c, $user));
    }
}

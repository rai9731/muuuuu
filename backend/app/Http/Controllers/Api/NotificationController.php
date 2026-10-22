<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Message;
use App\Support\Presenter;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $q = AppNotification::where('user_id', $request->user()->id)->latest('id');
        $request->query('filter') === 'unread' && $q->whereNull('read_at');
        $request->filled('type') && $q->where('type', $request->query('type'));

        return Presenter::page($q->paginate(15), fn ($n) => $this->format($n));
    }

    public function unreadCounts(Request $request)
    {
        $id = $request->user()->id;

        return ['data' => [
            'notifications' => AppNotification::where('user_id', $id)->whereNull('read_at')->count(),
            'messages' => Message::whereNull('read_at')->where('sender_id', '!=', $id)
                ->whereHas('conversation', fn ($c) => $c->where('buyer_id', $id)->orWhere('seller_id', $id))->count(),
            'latest_notification_id' => AppNotification::where('user_id', $id)->max('id'),
        ]];
    }

    public function since(Request $request)
    {
        $after = (int) $request->query('after', 0);

        return ['data' => AppNotification::where('user_id', $request->user()->id)->where('id', '>', $after)
            ->orderBy('id')->limit(20)->get()->map(fn ($n) => $this->format($n))->all()];
    }

    public function markRead(Request $request, int $id)
    {
        AppNotification::where('user_id', $request->user()->id)->whereKey($id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->noContent();
    }

    public function markAllRead(Request $request)
    {
        AppNotification::where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->noContent();
    }

    private function format(AppNotification $n): array
    {
        return [
            'id' => $n->id, 'type' => $n->type, 'title' => $n->title, 'body' => $n->body,
            'data' => $n->data ?? (object) [], 'image_url' => $n->data['image_url'] ?? null,
            'read_at' => $n->read_at?->toIso8601String(), 'created_at' => $n->created_at->toIso8601String(),
        ];
    }
}

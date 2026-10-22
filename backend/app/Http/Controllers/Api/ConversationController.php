<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Cow;
use App\Models\Message;
use App\Models\User;
use App\Support\Presenter;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    private const WITH = ['cow.media', 'buyer', 'seller'];

    public function index(Request $request)
    {
        $me = $request->user();
        $list = Conversation::with(self::WITH)->where(fn ($w) => $w->where('buyer_id', $me->id)->orWhere('seller_id', $me->id))
            ->orderByDesc('last_message_at')->get();

        return ['data' => $list->map(fn ($c) => $this->format($c, $me))->all()];
    }

    public function store(Request $request)
    {
        $me = $request->user();
        $data = $request->validate(['cow_id' => ['required', 'exists:cows,id'], 'body' => ['required', 'string', 'max:2000']]);
        $cow = Cow::findOrFail($data['cow_id']);
        abort_if($cow->user_id === $me->id, 422, 'Você não pode conversar com você mesmo.');

        $conv = Conversation::firstOrCreate(['cow_id' => $cow->id, 'buyer_id' => $me->id], ['seller_id' => $cow->user_id]);
        $this->add($conv, $me, $data['body']);

        return response()->json(['data' => $this->format($conv->load(self::WITH), $me)], 201);
    }

    public function show(Request $request, int $id)
    {
        $me = $request->user();
        $conv = $this->mine($me, $id);
        $conv->messages()->whereNull('read_at')->where('sender_id', '!=', $me->id)->update(['read_at' => now()]);

        return [
            'data' => $conv->messages()->orderBy('id')->get()->map(fn ($m) => $this->message($m, $me))->all(),
            'conversation' => $this->format($conv, $me),
        ];
    }

    public function send(Request $request, int $id)
    {
        $me = $request->user();
        $conv = $this->mine($me, $id);
        $body = $request->validate(['body' => ['required', 'string', 'max:2000']])['body'];

        return response()->json(['data' => $this->message($this->add($conv, $me, $body), $me)], 201);
    }

    private function mine(User $me, int $id): Conversation
    {
        $conv = Conversation::with(self::WITH)->findOrFail($id);
        abort_unless($conv->includes($me), 404);

        return $conv;
    }

    private function add(Conversation $conv, User $sender, string $body): Message
    {
        $message = Message::create(['conversation_id' => $conv->id, 'sender_id' => $sender->id, 'body' => trim($body)]);
        $conv->forceFill(['last_message_at' => now()])->save();

        return $message;
    }

    private function message(Message $m, User $me): array
    {
        return [
            'id' => $m->id, 'body' => $m->body, 'sender_id' => $m->sender_id, 'read_at' => $m->read_at?->toIso8601String(),
            'created_at' => $m->created_at->toIso8601String(), 'mine' => $m->sender_id === $me->id,
        ];
    }

    private function format(Conversation $c, User $me): array
    {
        $other = $c->buyer_id === $me->id ? $c->seller : $c->buyer;
        $last = $c->messages()->latest('id')->first();
        $cover = $c->cow->media->firstWhere('type', 'photo');

        return [
            'id' => $c->id,
            'cow' => ['id' => $c->cow->id, 'title' => $c->cow->title, 'cover_thumb_url' => Presenter::url($cover?->path), 'price' => $c->cow->price, 'status' => $c->cow->status],
            'other' => Presenter::person($other),
            'last_message' => $last ? ['body' => $last->body, 'created_at' => $last->created_at->toIso8601String(), 'mine' => $last->sender_id === $me->id] : null,
            'unread_count' => $c->messages()->whereNull('read_at')->where('sender_id', '!=', $me->id)->count(),
            'role' => $c->buyer_id === $me->id ? 'buyer' : 'seller',
            'updated_at' => ($c->last_message_at ?? $c->updated_at)->toIso8601String(),
        ];
    }
}

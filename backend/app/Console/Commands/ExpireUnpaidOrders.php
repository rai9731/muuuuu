<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\Notifier;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpireUnpaidOrders extends Command
{
    protected $signature = 'orders:expire';

    protected $description = 'Cancela pedidos não pagos após o vencimento e devolve o animal à vitrine (RN04)';

    public function handle(): int
    {
        $orders = Order::with(['payment', 'cow'])
            ->where('status', 'awaiting_payment')
            ->whereHas('payment', fn ($p) => $p->whereDate('due_date', '<', now()->toDateString()))
            ->get();

        foreach ($orders as $order) {
            DB::transaction(function () use ($order) {
                $order->update(['status' => 'cancelled', 'cancelled_at' => now()]);
                $order->payment?->update(['status' => 'cancelled']);
                if ($order->cow?->status === 'reserved') {
                    $order->cow->forceFill(['status' => 'active'])->save();
                }
            });

            Notifier::to($order->buyer_id, 'order_update', 'Pedido cancelado por falta de pagamento', '#'.$order->code, ['order_id' => $order->id]);
            Notifier::to($order->seller_id, 'order_update', 'Pedido cancelado — seu animal voltou à vitrine', '#'.$order->code, ['order_id' => $order->id]);
        }

        $this->info("{$orders->count()} pedido(s) cancelado(s).");

        return self::SUCCESS;
    }
}

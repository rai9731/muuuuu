<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\Payment;
use App\Services\Notifier;
use Illuminate\Support\Facades\DB;

/**
 * Ciclo da cobrança Pix de um pedido. Regras:
 *  - preço e identidade vêm do pedido gravado a partir do anúncio no banco, nunca do navegador;
 *  - a criação é tentada uma única vez por estado "preparing"; resultado incerto NUNCA é repetido
 *    automaticamente (só reconciliado por referência);
 *  - "paid" só depois de consultar o gateway e validar id, referência, valor e status.
 */
class PixPaymentService
{
    public const CONFIRMED = 'confirmed';
    public const PENDING = 'pending';
    public const DIVERGENT = 'divergent';
    public const INCONCLUSIVE = 'inconclusive';
    public const NOT_FOUND = 'not_found';
    public const PREPARING = 'preparing';

    /** Status do gateway que valem como pagamento recebido. */
    private const PAID_STATUSES = ['RECEIVED', 'CONFIRMED'];

    public function __construct(private readonly PixGateway $gateway) {}

    public function gateway(): PixGateway
    {
        return $this->gateway;
    }

    /** Valor gravado em payments.gateway para o gateway ativo (distingue simulação, Sandbox e o futuro real). */
    public function gatewayName(): string
    {
        return match ($this->gateway->source()) {
            'simulation' => 'simulated',
            'asaas_sandbox' => 'asaas_sandbox',
            default => throw new \LogicException('Origem de gateway desconhecida.'),
        };
    }

    /** Cria a cobrança uma única vez. Chamada após o commit do pedido (sem segurar lock durante a chamada externa). */
    public function ensureCharge(Payment $payment): Payment
    {
        $claimed = DB::transaction(function () use ($payment) {
            $p = Payment::lockForUpdate()->find($payment->id);
            if ($p->status !== 'preparing') {
                return false; // já criada, em criação ou incerta: não duplicar
            }
            $p->update(['status' => 'creating']);

            return true;
        });
        if (! $claimed) {
            return $payment->refresh();
        }

        $payment->refresh(); // o claim acima gravou "creating" por outra instância
        $order = Order::findOrFail($payment->order_id);
        try {
            $charge = $this->gateway->createPixCharge($order->code, (float) $payment->amount, $payment->due_date);
            if (! $this->matches($charge, $order, $payment)) {
                throw new GatewayUncertain('Resposta da criação não corresponde ao pedido.');
            }
            $payment->update([
                'status' => 'pending', 'gateway_id' => $charge->id, 'external_reference' => $order->code,
                'gateway_status' => $charge->status, 'pix_payload' => $charge->pixPayload, 'pix_qr_image' => $charge->pixQrImage,
            ]);
        } catch (GatewayRejected) {
            $payment->update(['status' => 'preparing', 'last_check_result' => 'rejected', 'last_checked_at' => now()]);
        } catch (\Throwable) {
            // Timeout, rede, resposta inválida ou qualquer falha após o envio: pode ter sido criada.
            $payment->update(['status' => 'uncertain', 'external_reference' => $order->code, 'last_check_result' => self::INCONCLUSIVE, 'last_checked_at' => now()]);
        }

        return $payment->refresh();
    }

    /** Conferência explícita pedida pelo comprador. Devolve uma das constantes de resultado. */
    public function check(Order $order): string
    {
        $payment = $order->payment;
        if (! $payment) {
            return self::PREPARING;
        }
        if ($order->status !== 'awaiting_payment') {
            return $payment->status === 'approved' ? self::CONFIRMED : self::PENDING;
        }
        // O pedido foi criado por outro gateway (ex.: simulado) e o ativo agora é outro: não consulta nem confirma.
        if ($payment->gateway !== $this->gatewayName()) {
            return self::INCONCLUSIVE;
        }

        $result = match ($payment->status) {
            'preparing' => $this->retryAfterRejection($payment),
            'creating', 'uncertain' => $this->reconcile($payment, $order),
            default => $this->verify($payment, $order),
        };
        $payment->refresh()->update(['last_check_result' => $result, 'last_checked_at' => now()]);

        return $result;
    }

    private function retryAfterRejection(Payment $payment): string
    {
        // 'preparing' com recusa definitiva anterior (ou nunca tentada): tentativa explícita do usuário.
        $p = $this->ensureCharge($payment);

        return match ($p->status) {
            'pending' => self::PENDING,
            'uncertain' => self::INCONCLUSIVE,
            default => self::PREPARING,
        };
    }

    /** Resultado incerto na criação: procurar por referência; nunca criar de novo. */
    private function reconcile(Payment $payment, Order $order): string
    {
        try {
            $found = $this->gateway->findByReference($order->code);
        } catch (\Throwable) {
            return self::INCONCLUSIVE;
        }
        if (count($found) === 0) {
            return self::NOT_FOUND;
        }
        if (count($found) > 1 || ! $this->matches($found[0], $order, $payment)) {
            $payment->update(['status' => 'divergent']);

            return self::DIVERGENT;
        }
        $c = $found[0];
        $payment->update([
            'status' => 'pending', 'gateway_id' => $c->id, 'external_reference' => $order->code,
            'gateway_status' => $c->status, 'pix_payload' => $c->pixPayload, 'pix_qr_image' => $c->pixQrImage,
        ]);

        return $this->verify($payment->refresh(), $order);
    }

    private function verify(Payment $payment, Order $order): string
    {
        if (! $payment->gateway_id) {
            return self::PREPARING;
        }
        try {
            $charge = $this->gateway->getCharge($payment->gateway_id);
        } catch (\Throwable) {
            return self::INCONCLUSIVE; // falha de rede/resposta inválida: não vira sucesso nem derruba o estado
        }

        $payment->update(['gateway_status' => $charge->status]);
        if ($charge->id !== $payment->gateway_id || ! $this->matches($charge, $order, $payment)) {
            $payment->update(['status' => 'divergent']);

            return self::DIVERGENT;
        }
        if ($payment->status === 'divergent') {
            $payment->update(['status' => 'pending']); // reavalia: a divergência anterior deixou de existir
        }
        if (! in_array($charge->status, self::PAID_STATUSES, true)) {
            return self::PENDING;
        }

        return $this->markPaid($order->id, $payment->id) ? self::CONFIRMED : self::PENDING;
    }

    private function markPaid(int $orderId, int $paymentId): bool
    {
        $order = DB::transaction(function () use ($orderId, $paymentId) {
            $order = Order::lockForUpdate()->findOrFail($orderId);
            if ($order->status !== 'awaiting_payment') {
                return null; // já confirmado/cancelado: não transicionar duas vezes
            }
            $order->update(['status' => 'paid', 'paid_at' => now(), 'payout_status' => 'pending']);
            Payment::whereKey($paymentId)->update([
                'status' => 'approved', 'paid_at' => now(), 'confirmation_source' => $this->gateway->source(),
            ]);

            return $order;
        });
        if (! $order) {
            return false;
        }

        if ($this->gateway->source() === 'simulation') {
            $note = '#'.$order->code.' · demonstração local, nenhum pagamento real';
            Notifier::to($order->buyer_id, 'payment_confirmed', 'Confirmação SIMULADA do pagamento', $note, ['order_id' => $order->id, 'simulated' => true]);
            Notifier::to($order->seller_id, 'payment_confirmed', 'Pagamento SIMULADO — não envie o animal', $note, ['order_id' => $order->id, 'simulated' => true]);
        } elseif ($this->gateway->source() === 'asaas_sandbox') {
            $note = '#'.$order->code.' · cobrança de TESTE no Asaas Sandbox, nenhum pagamento real';
            Notifier::to($order->buyer_id, 'payment_confirmed', 'Pagamento confirmado no SANDBOX (teste)', $note, ['order_id' => $order->id, 'sandbox' => true]);
            Notifier::to($order->seller_id, 'payment_confirmed', 'Pagamento de TESTE (Sandbox) — não envie o animal', $note, ['order_id' => $order->id, 'sandbox' => true]);
        } else {
            Notifier::to($order->buyer_id, 'payment_confirmed', 'Pagamento confirmado', '#'.$order->code, ['order_id' => $order->id]);
            Notifier::to($order->seller_id, 'payment_confirmed', 'Pagamento confirmado — envie o animal', '#'.$order->code, ['order_id' => $order->id]);
        }

        return true;
    }

    /** A cobrança do gateway precisa pertencer a este pedido e ter exatamente o valor gravado. */
    private function matches(PixCharge $c, Order $order, Payment $payment): bool
    {
        $cents = fn (float $v) => (int) round($v * 100);

        return $c->reference === $order->code
            && $cents($c->value) === $cents((float) $payment->amount)
            && $cents((float) $payment->amount) === $cents((float) $order->total);
    }
}

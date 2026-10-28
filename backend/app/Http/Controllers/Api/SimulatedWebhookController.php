<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\Payments\PixPaymentService;
use Illuminate\Http\Request;

/**
 * Webhook LOCAL e SIMULADO. Não é o webhook do Asaas e não recebe nada de fora: serve para demonstrar, com um aviso
 * fictício, o caminho "aviso -> conferência no gateway -> confirmação".
 *
 * Regras:
 *  - desligado por padrão: sem SIMULATED_WEBHOOK_TOKEN (config boinarede.simulated_webhook_token) responde 404;
 *    só existe com o gateway SIMULADO ativo (nunca com o Asaas Sandbox);
 *  - exige o token de teste no cabeçalho X-Webhook-Token (comparação em tempo constante);
 *  - o CONTEÚDO do aviso nunca confirma pagamento: ele só identifica o pedido/cobrança. Quem decide é a mesma conferência
 *    do caminho manual ({@see PixPaymentService::check}), que consulta o gateway e valida id, referência, valor e status;
 *  - repetir o mesmo aviso não duplica a transição nem as notificações (a conferência é idempotente).
 */
class SimulatedWebhookController extends Controller
{
    public function __construct(private readonly PixPaymentService $pix) {}

    public function __invoke(Request $request)
    {
        $expected = (string) config('boinarede.simulated_webhook_token');
        abort_if($expected === '' || $this->pix->gatewayName() !== 'simulated', 404);

        $given = (string) $request->header('X-Webhook-Token', '');
        abort_unless($given !== '' && hash_equals($expected, $given), 401, 'Token do webhook de teste ausente ou incorreto.');

        $data = $request->validate([
            'payment.id' => ['required', 'string', 'max:64'],
            'payment.externalReference' => ['required', 'string', 'max:64'],
            'payment.value' => ['nullable', 'numeric'],
        ]);

        $payment = Payment::where('gateway', 'simulated')->where('gateway_id', $data['payment']['id'])->first();
        abort_unless($payment && $payment->order, 404, 'Cobrança simulada desconhecida.');
        $order = $payment->order;

        // O aviso precisa apontar para o MESMO pedido e valor gravados; caso contrário é rejeitado sem consultar nem alterar nada.
        abort_unless($data['payment']['externalReference'] === $order->code, 422, 'Referência do aviso não corresponde ao pedido.');
        if (isset($data['payment']['value'])) {
            abort_unless((int) round($data['payment']['value'] * 100) === (int) round((float) $payment->amount * 100), 422, 'Valor do aviso não corresponde à cobrança.');
        }

        $result = $this->pix->check($order); // consulta o gateway simulado; só ele pode confirmar

        return response()->json([
            'data' => ['result' => $result, 'order' => $order->code, 'origin' => 'webhook_local_simulado', 'simulated' => true],
            'message' => 'Aviso SIMULADO processado pela conferência; o conteúdo do aviso não confirma pagamento.',
        ], in_array($result, [PixPaymentService::INCONCLUSIVE], true) ? 503 : 200);
    }
}

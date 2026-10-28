<?php

namespace App\Services\Payments;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Gateway SIMULADO para desenvolvimento e demonstração local. Guarda o "estado remoto" no cache,
 * separado do banco da aplicação, para que a conferência tenha de consultá-lo como faria com o Asaas.
 * Nada aqui é pagamento real nem observado no Asaas.
 */
class SimulatedPixGateway implements PixGateway
{
    public function source(): string
    {
        return 'simulation';
    }

    public function createPixCharge(string $reference, float $amount, CarbonInterface $dueDate): PixCharge
    {
        $id = 'sim_pay_'.Str::lower(Str::random(12));
        $charge = new PixCharge($id, $reference, $amount, 'PENDING', '00020126SIMULADO'.$reference, null);
        $this->store($charge);
        Cache::forever("simgw:ref:{$reference}", array_merge(Cache::get("simgw:ref:{$reference}", []), [$id]));

        return $charge;
    }

    public function findByReference(string $reference): array
    {
        return array_values(array_filter(array_map(fn ($id) => $this->load($id), Cache::get("simgw:ref:{$reference}", []))));
    }

    public function getCharge(string $id): PixCharge
    {
        return $this->load($id) ?? throw new GatewayUncertain('Cobrança simulada não encontrada.');
    }

    /** Ação de demonstração: "o comprador pagou" no gateway simulado (não confirma o pedido por si só). */
    public function markReceived(string $id): void
    {
        $c = $this->getCharge($id);
        $this->store(new PixCharge($c->id, $c->reference, $c->value, 'RECEIVED', $c->pixPayload, $c->pixQrImage));
    }

    private function store(PixCharge $c): void
    {
        Cache::forever("simgw:charge:{$c->id}", [
            'id' => $c->id, 'reference' => $c->reference, 'value' => $c->value, 'status' => $c->status, 'pix' => $c->pixPayload,
        ]);
    }

    private function load(string $id): ?PixCharge
    {
        $d = Cache::get("simgw:charge:{$id}");

        return $d ? new PixCharge($d['id'], $d['reference'], (float) $d['value'], $d['status'], $d['pix']) : null;
    }
}

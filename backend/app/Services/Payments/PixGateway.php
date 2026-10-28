<?php

namespace App\Services\Payments;

use Carbon\CarbonInterface;

/**
 * Contrato mínimo com o gateway de Pix. Status do gateway usam o vocabulário do Asaas
 * (PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED...) para que o adaptador real seja trivial.
 */
interface PixGateway
{
    /** Identifica a origem da confirmação: 'simulation' ou 'asaas_sandbox'. */
    public function source(): string;

    /**
     * @throws GatewayRejected  o gateway recusou de forma definitiva (nenhuma cobrança foi criada)
     * @throws GatewayUncertain timeout/erro de rede/resposta ilegível: a cobrança pode ter sido criada
     */
    public function createPixCharge(string $reference, float $amount, CarbonInterface $dueDate): PixCharge;

    /** @return PixCharge[] cobranças já existentes para a referência (reconciliação após resultado incerto). */
    public function findByReference(string $reference): array;

    /** @throws GatewayUncertain */
    public function getCharge(string $id): PixCharge;
}

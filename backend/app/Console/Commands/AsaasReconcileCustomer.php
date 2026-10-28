<?php

namespace App\Console\Commands;

use App\Services\Payments\Asaas\AsaasPixGateway;
use App\Services\Payments\PixGateway;
use Illuminate\Console\Command;

/**
 * Reconciliação EXPLÍCITA do cliente de teste do Asaas Sandbox após um resultado incerto na criação.
 * Só faz uma listagem (GET, contabilizada no orçamento) e nunca cria cliente. Só deve ser executado em janela autorizada.
 */
class AsaasReconcileCustomer extends Command
{
    protected $signature = 'asaas:reconcile-customer {--release-if-not-found : libera o estado incerto SOMENTE se a listagem concluir que o cliente não existe}';

    protected $description = 'Reconcilia o cliente de teste do Asaas Sandbox em estado incerto (nunca cria cliente).';

    public function handle(PixGateway $gateway): int
    {
        if (! $gateway instanceof AsaasPixGateway) {
            $this->error('O gateway ativo não é o Asaas Sandbox. Nada foi feito.');

            return self::FAILURE;
        }

        $this->line('Estado antes: '.$gateway->customerStatus());
        if ($this->option('release-if-not-found')) {
            $this->warn('Só libere se tiver confirmado que nenhuma criação de cliente está em andamento (uma listagem vazia não prova isso).');
            $released = $gateway->releaseUncertainCustomer();
            $this->line($released ? 'Cliente não encontrado: estado liberado (nenhum cliente foi criado).' : 'Não liberado: a reconciliação não concluiu "não encontrado".');
        } else {
            $this->line('Resultado: '.$gateway->reconcileCustomer());
        }
        $this->line('Estado depois: '.$gateway->customerStatus());
        $this->line('Requisições contabilizadas: '.json_encode($gateway->ledger()));

        return self::SUCCESS;
    }
}

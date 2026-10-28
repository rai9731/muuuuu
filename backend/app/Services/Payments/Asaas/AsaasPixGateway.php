<?php

namespace App\Services\Payments\Asaas;

use App\Models\Setting;
use App\Services\Payments\GatewayRejected;
use App\Services\Payments\GatewayUncertain;
use App\Services\Payments\PixCharge;
use App\Services\Payments\PixGateway;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Adaptador do Asaas SANDBOX (nunca produção). Nenhuma requisição acontece fora de AsaasHttp, que aplica
 * URL exata, orçamento por operação, sem redirecionamento e sem repetição automática.
 *
 * Regras de incerteza (nunca criar de novo):
 *  - cliente: antes de enviar grava o estado "creating"; timeout/resposta inválida => "uncertain" e nenhuma nova
 *    criação até reconciliação explícita (reconcileCustomer). Como a cobrança nunca chegou a ser enviada,
 *    o resultado para o pedido é GatewayRejected (cobrança definitivamente não criada).
 *  - cobrança: timeout/5xx/redirecionamento/resposta inválida => GatewayUncertain (o serviço registra "uncertain");
 *    a reconciliação só LÊ (findByReference). externalReference sozinha não prova vínculo: só entram candidatas do
 *    cliente de teste, modalidade PIX, estrutura válida e lista completa (sem paginação pendente).
 */
class AsaasPixGateway implements PixGateway
{
    /** Status de cobrança conhecidos do Asaas; qualquer outro é tratado como resposta inválida. */
    private const KNOWN_STATUSES = [
        'PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED',
        'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL',
        'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS',
    ];

    private const CUSTOMER_STATE_KEY = 'asaas_sandbox_customer';

    public function __construct(private readonly AsaasConfig $config, private readonly AsaasHttp $http) {}

    public function source(): string
    {
        return 'asaas_sandbox';
    }

    public function ledger(): array
    {
        return $this->http->ledger();
    }

    // ───────────── cobrança ─────────────

    public function createPixCharge(string $reference, float $amount, CarbonInterface $dueDate): PixCharge
    {
        preg_match('/^BNR-[A-Z0-9]{8}$/', $reference) === 1 || throw new GatewayRejected('Referência de pedido inválida.');
        ($amount > 0 && $amount < 1000000) || throw new GatewayRejected('Valor inválido.');

        $customer = $this->customerId();

        // Uma criação por recurso (defesa adicional à regra de incerteza): uma segunda tentativa para a mesma referência
        // nunca envia outro POST, mesmo com orçamento sobrando. Só é liberada se NADA foi enviado (orçamento).
        $guard = 'asaas:create-attempt:'.$reference;
        try {
            $first = Cache::add($guard, now()->toIso8601String());
        } catch (\Throwable) {
            throw new GatewayRejected('Controle de criação indisponível; nada foi enviado.');
        }
        $first || throw new GatewayUncertain('Já houve tentativa de criação desta cobrança; reconcilie, não recrie.');

        try {
            $body = $this->http->send('payment_create', 'POST', '/payments', [], [
                'customer' => $customer, 'billingType' => 'PIX', 'value' => round($amount, 2),
                'dueDate' => $dueDate->format('Y-m-d'), 'externalReference' => $reference,
                'description' => 'Pedido de teste '.$reference,
            ]);
        } catch (AsaasRefusedException $e) {
            Cache::forget($guard); // nada foi enviado
            throw new GatewayRejected($e->getMessage());
        } catch (AsaasTransportException $e) { // inclui 4xx: enviada, resultado incerto
            throw new GatewayUncertain($e->getMessage());
        }

        // A cobrança PODE existir: qualquer resposta que não prove vínculo vira incerteza, nunca sucesso.
        $charge = $this->validatePayment($body, null, $customer);
        if ($charge->reference !== $reference || $this->cents($charge->value) !== $this->cents($amount)) {
            throw new GatewayUncertain('Resposta da criação diverge do pedido.');
        }

        [$payload, $image] = $this->fetchQr($charge->id);

        return new PixCharge($charge->id, $charge->reference, $charge->value, $charge->status, $payload, $image);
    }

    public function findByReference(string $reference): array
    {
        preg_match('/^BNR-[A-Z0-9]{8}$/', $reference) === 1 || throw new GatewayUncertain('Referência inválida.');
        $customer = $this->knownCustomerId() ?? throw new GatewayUncertain('Cliente de teste desconhecido.');

        $body = $this->read('payment_list', '/payments', ['externalReference' => $reference, 'limit' => 10]);
        (($body['object'] ?? null) === 'list' && is_array($body['data'] ?? null) && ($body['hasMore'] ?? null) === false)
            || throw new GatewayUncertain('Lista de cobranças incompleta ou inválida.');

        $found = [];
        foreach ($body['data'] as $item) {
            is_array($item) || throw new GatewayUncertain('Item de lista inválido.');
            $c = $this->validatePayment($item, null, null);
            if (($item['customer'] ?? null) === $customer && ($item['billingType'] ?? null) === 'PIX') {
                $found[] = $c;
            }
        }
        if (count($found) === 1) {
            [$payload, $image] = $this->fetchQr($found[0]->id);
            $c = $found[0];
            $found[0] = new PixCharge($c->id, $c->reference, $c->value, $c->status, $payload, $image);
        }

        return $found;
    }

    public function getCharge(string $id): PixCharge
    {
        preg_match('/^pay_[A-Za-z0-9]+$/', $id) === 1 || throw new GatewayUncertain('Identificador de cobrança inválido.');
        $customer = $this->knownCustomerId() ?? throw new GatewayUncertain('Cliente de teste desconhecido.');

        return $this->validatePayment($this->read('payment_get', '/payments/'.$id), $id, $customer);
    }

    // ───────────── cliente de teste ─────────────

    /** Id do cliente de teste a usar. Nunca cria cliente novo se o estado for incerto. @throws GatewayRejected */
    private function customerId(): string
    {
        if ($known = $this->knownCustomerId()) {
            return $known;
        }

        $state = $this->customerState();
        if ($state !== null) {
            throw new GatewayRejected('Cliente de teste em estado '.$state['state'].': reconcilie antes de continuar (nenhuma requisição enviada).');
        }

        // Reivindica a criação (uma única vez) antes de qualquer requisição.
        $claimed = DB::transaction(function () {
            $row = Setting::withTrashed()->where('key', self::CUSTOMER_STATE_KEY)->lockForUpdate()->first();
            if ($row && ($row->value['v']['state'] ?? null) !== null) {
                return false;
            }
            $row ??= new Setting(['key' => self::CUSTOMER_STATE_KEY]);
            $row->deleted_at = null;
            $row->value = ['v' => ['state' => 'creating']];
            $row->save();

            return true;
        });
        $claimed || throw new GatewayRejected('Cliente de teste já em criação ou incerto (nenhuma requisição enviada).');

        try {
            $body = $this->http->send('customer_create', 'POST', '/customers', [], [
                'name' => $this->config->customerName, 'cpfCnpj' => $this->config->customerDocument,
                'externalReference' => AsaasConfig::CUSTOMER_REFERENCE, 'notificationDisabled' => true,
            ]);
        } catch (AsaasRefusedException $e) {
            $this->setCustomerState(null); // nada foi enviado (orçamento esgotado/indisponível)
            throw new GatewayRejected($e->getMessage());
        } catch (AsaasTransportException $e) { // inclui 4xx: enviada, resultado incerto
            $this->setCustomerState(['state' => 'uncertain']);
            throw new GatewayRejected('Resultado incerto na criação do cliente de teste; nenhuma cobrança enviada. '.$e->getMessage());
        }

        $id = $this->matchingCustomerId($body);
        if ($id === null) {
            $this->setCustomerState(['state' => 'uncertain']); // o cliente pode ter sido criado
            throw new GatewayRejected('Resposta da criação do cliente inválida ou divergente; nenhuma cobrança enviada.');
        }
        $this->setCustomerState(['state' => 'ready', 'id' => $id]);

        return $id;
    }

    /**
     * Reconciliação explícita do cliente incerto: só LÊ (uma listagem). Devolve ready | not_found | ambiguous |
     * inconclusive | nothing_to_do. Nunca cria cliente.
     */
    public function reconcileCustomer(): string
    {
        if ($this->config->customerId !== null) {
            return 'nothing_to_do';
        }
        $state = $this->customerState();
        if ($state === null) {
            return 'nothing_to_do';
        }
        if ($state['state'] === 'ready') {
            return 'ready';
        }

        try {
            $body = $this->http->send('customer_list', 'GET', '/customers', ['externalReference' => AsaasConfig::CUSTOMER_REFERENCE, 'limit' => 10]);
        } catch (AsaasRefusedException|AsaasTransportException) {
            return 'inconclusive';
        }
        if (($body['object'] ?? null) !== 'list' || ! is_array($body['data'] ?? null) || ($body['hasMore'] ?? null) !== false) {
            return 'inconclusive';
        }
        $ids = [];
        foreach ($body['data'] as $item) {
            if (! is_array($item)) {
                return 'inconclusive';
            }
            if ($id = $this->matchingCustomerId($item)) {
                $ids[] = $id;
            }
        }
        // "não encontrado" SÓ para lista completa, válida e literalmente vazia. Qualquer item sem correspondência
        // estrita (ex.: referência certa, nome ou documento divergente) ou mais de um candidato é ambíguo.
        if ($body['data'] === []) {
            return 'not_found';
        }
        if (count($ids) !== 1 || count($body['data']) !== 1) {
            return 'ambiguous';
        }
        $this->setCustomerState(['state' => 'ready', 'id' => $ids[0]]);

        return 'ready';
    }

    /**
     * Libera o estado incerto SOMENTE se a listagem acabou de ser completa, válida e vazia ("not_found"). A listagem
     * vazia não prova que não há criação ainda em andamento (ex.: estado `creating` de um processo vivo): quem executa
     * precisa confirmar isso antes. Ação humana explícita.
     */
    public function releaseUncertainCustomer(): bool
    {
        if ($this->reconcileCustomer() !== 'not_found') {
            return false;
        }
        $this->setCustomerState(null);

        return true;
    }

    public function customerStatus(): string
    {
        if ($this->config->customerId !== null) {
            return 'configured';
        }

        return $this->customerState()['state'] ?? 'none';
    }

    private function knownCustomerId(): ?string
    {
        if ($this->config->customerId !== null) {
            return $this->config->customerId;
        }
        $s = $this->customerState();

        return ($s['state'] ?? null) === 'ready' && preg_match('/^cus_[A-Za-z0-9]+$/', (string) ($s['id'] ?? '')) === 1 ? $s['id'] : null;
    }

    private function customerState(): ?array
    {
        $v = Setting::read(self::CUSTOMER_STATE_KEY);

        return is_array($v) && isset($v['state']) ? $v : null;
    }

    private function setCustomerState(?array $state): void
    {
        Setting::write(self::CUSTOMER_STATE_KEY, $state);
    }

    /** Id do cliente se o objeto é um cliente válido, igual aos dados de teste configurados e não removido. */
    private function matchingCustomerId(array $c): ?string
    {
        $ok = ($c['object'] ?? null) === 'customer'
            && is_string($c['id'] ?? null) && preg_match('/^cus_[A-Za-z0-9]+$/', $c['id']) === 1
            && ($c['deleted'] ?? false) !== true
            && ($c['externalReference'] ?? null) === AsaasConfig::CUSTOMER_REFERENCE
            && is_string($c['name'] ?? null) && $c['name'] === $this->config->customerName
            && is_string($c['cpfCnpj'] ?? null) && preg_replace('/\D/', '', $c['cpfCnpj']) === $this->config->customerDocument;

        return $ok ? $c['id'] : null;
    }

    // ───────────── validação e leitura ─────────────

    /** Leitura (GET) em que qualquer falha é "inconclusivo". @throws GatewayUncertain */
    private function read(string $op, string $path, array $query = []): array
    {
        try {
            return $this->http->send($op, 'GET', $path, $query);
        } catch (AsaasRefusedException|AsaasTransportException $e) {
            throw new GatewayUncertain($e->getMessage());
        }
    }

    /**
     * Valida estrutura da cobrança. Valor e referência divergentes NÃO lançam: voltam no PixCharge para que o serviço
     * marque "divergente". Estrutura inválida, cliente/modalidade/moeda errados, removida ou status desconhecido lançam.
     *
     * @throws GatewayUncertain
     */
    private function validatePayment(array $p, ?string $expectedId, ?string $expectedCustomer): PixCharge
    {
        $bad = fn (string $why) => throw new GatewayUncertain('Cobrança inválida: '.$why);

        ($p['object'] ?? null) === 'payment' || $bad('objeto');
        (is_string($p['id'] ?? null) && preg_match('/^pay_[A-Za-z0-9]+$/', $p['id']) === 1) || $bad('id');
        $expectedId === null || $p['id'] === $expectedId || $bad('id diferente do consultado');
        $expectedCustomer === null || ($p['customer'] ?? null) === $expectedCustomer || $bad('cliente');
        (is_string($p['customer'] ?? null) && $p['customer'] !== '') || $bad('cliente ausente');
        ($p['billingType'] ?? null) === 'PIX' || $this->isListItem($expectedCustomer) || $bad('modalidade');
        (is_string($p['status'] ?? null) && in_array($p['status'], self::KNOWN_STATUSES, true)) || $bad('status desconhecido');
        ($p['deleted'] ?? false) !== true || $bad('removida');
        (is_int($p['value'] ?? null) || is_float($p['value'] ?? null)) || $bad('valor');
        (is_string($p['externalReference'] ?? null) && $p['externalReference'] !== '') || $bad('referência ausente');
        ! array_key_exists('currency', $p) || $p['currency'] === 'BRL' || $bad('moeda');

        return new PixCharge($p['id'], $p['externalReference'], (float) $p['value'], $p['status']);
    }

    /** Em listagens (sem cliente esperado) a modalidade é filtrada depois, não invalida a lista inteira. */
    private function isListItem(?string $expectedCustomer): bool
    {
        return $expectedCustomer === null;
    }

    /** @return array{0:?string,1:?string} [payload, imagem base64]; falha => [null, null] (a cobrança já existe). */
    private function fetchQr(string $paymentId): array
    {
        try {
            $q = $this->http->send('qr', 'GET', "/payments/{$paymentId}/pixQrCode");
        } catch (AsaasRefusedException|AsaasTransportException) {
            return [null, null];
        }
        $payload = is_string($q['payload'] ?? null) && $q['payload'] !== '' && strlen($q['payload']) <= 2000 ? $q['payload'] : null;
        $image = is_string($q['encodedImage'] ?? null) && strlen($q['encodedImage']) <= 200000 && preg_match('#^[A-Za-z0-9+/=]+$#', $q['encodedImage']) === 1 ? $q['encodedImage'] : null;

        return $payload === null ? [null, null] : [$payload, $image];
    }

    private function cents(float $v): int
    {
        return (int) round($v * 100);
    }
}

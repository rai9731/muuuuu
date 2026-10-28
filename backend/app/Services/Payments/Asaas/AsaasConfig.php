<?php

namespace App\Services\Payments\Asaas;

/**
 * Configuração validada do adaptador. Falha fechado: qualquer inconsistência lança
 * AsaasConfigurationException e o adaptador não é criado (nenhuma requisição é possível).
 *
 * Não se tenta distinguir chave de Sandbox de chave de produção pelo formato: a proteção é a URL exata,
 * a declaração explícita do ambiente e a autorização explícita da janela.
 */
final class AsaasConfig
{
    /** Única URL permitida (a prevista no projeto: config/services.php e .env.example). */
    public const SANDBOX_URL = 'https://sandbox.asaas.com/api/v3';

    /** Operações contabilizadas (uma por requisição HTTP). */
    public const OPERATIONS = ['customer_create', 'customer_list', 'payment_create', 'qr', 'payment_get', 'payment_list'];

    public const CUSTOMER_REFERENCE = 'BNR-TEST-CUSTOMER';

    /**
     * Drivers de cache aceitos para a trava de criação (`add` atômico compartilhado entre processos). O orçamento de
     * requisições NÃO usa cache: é a tabela `asaas_request_budget` (DurableBudget). `array` e `file` só em testes.
     */
    public const ATOMIC_CACHE_DRIVERS = ['database', 'redis', 'memcached'];

    /** @param array<string,int> $budget */
    private function __construct(
        public readonly string $url,
        public readonly string $key,
        public readonly ?string $customerId,
        public readonly ?string $customerName,
        public readonly ?string $customerDocument,
        public readonly array $budget,
        public readonly int $timeout,
    ) {}

    public static function fromConfig(): self
    {
        $c = (array) config('services.asaas');
        $fail = fn (string $why) => throw new AsaasConfigurationException('Asaas Sandbox não ativado: '.$why);

        ($c['env'] ?? null) === 'sandbox' || $fail("ASAAS_ENV deve ser exatamente 'sandbox'.");
        ($c['url'] ?? null) === self::SANDBOX_URL || $fail('ASAAS_API_URL não é a URL exata do Sandbox permitida.');
        (is_string($c['key'] ?? null) && trim($c['key']) !== '') || $fail('ASAAS_API_KEY ausente.');
        filter_var($c['sandbox_authorized'] ?? false, FILTER_VALIDATE_BOOL) === true
            || $fail('ASAAS_SANDBOX_AUTHORIZED não está habilitado (a janela precisa ser autorizada explicitamente).');

        $t = (array) ($c['test_customer'] ?? []);
        $id = isset($t['id']) && $t['id'] !== '' ? (string) $t['id'] : null;
        $name = isset($t['name']) && trim((string) $t['name']) !== '' ? trim((string) $t['name']) : null;
        $doc = isset($t['document']) ? preg_replace('/\D/', '', (string) $t['document']) : '';
        if ($id !== null) {
            preg_match('/^cus_[A-Za-z0-9]+$/', $id) === 1 || $fail('ASAAS_TEST_CUSTOMER_ID em formato inesperado.');
        } else {
            ($name !== null && in_array(strlen($doc), [11, 14], true))
                || $fail('defina ASAAS_TEST_CUSTOMER_ID ou o nome e o documento do cliente de TESTE (não use dados reais).');
        }

        $budget = [];
        foreach (self::OPERATIONS as $op) {
            $v = $c['budget'][$op] ?? null;
            ($v !== null && $v !== '' && ctype_digit((string) $v))
                || $fail("orçamento de requisições '{$op}' não definido (use um inteiro; 0 bloqueia a operação).");
            $budget[$op] = (int) $v;
        }

        $store = (string) config('cache.default');
        $driver = (string) config("cache.stores.{$store}.driver");
        (in_array($driver, self::ATOMIC_CACHE_DRIVERS, true) || app()->environment('testing'))
            || $fail("o cache '{$store}' (driver '{$driver}') não garante contador atômico entre processos; use database, redis ou memcached.");

        $timeout = (int) ($c['timeout'] ?? 10);
        ($timeout >= 1 && $timeout <= 30) || $fail('timeout fora do intervalo de 1 a 30 s.');

        return new self(self::SANDBOX_URL, trim($c['key']), $id, $name, $doc !== '' ? $doc : null, $budget, $timeout);
    }
}

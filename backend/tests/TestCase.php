<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Trava de segurança: os testes só rodam em SQLite em memória/temporário. Roda antes de qualquer
     * trait (RefreshDatabase etc.), então nenhuma query chega a um MySQL de desenvolvimento.
     */
    public function createApplication()
    {
        // O <env force> do phpunit.xml não vence variáveis já exportadas no container (DB_CONNECTION=mysql),
        // então o isolamento é imposto aqui, antes de o Laravel ler o ambiente.
        foreach ([
            'APP_ENV' => 'testing', 'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:', 'DB_URL' => '', 'DB_HOST' => '',
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync',
            // O container recebe ASAAS_* do .env (env_file do Compose): os testes nunca podem lê-las.
            'ASAAS_ENV' => '', 'ASAAS_API_URL' => '', 'ASAAS_API_KEY' => '', 'ASAAS_WEBHOOK_TOKEN' => '', 'ASAAS_WEBHOOK_URL' => '',
            'ASAAS_SANDBOX_AUTHORIZED' => '', 'ASAAS_TEST_CUSTOMER_ID' => '', 'ASAAS_TEST_CUSTOMER_NAME' => '', 'ASAAS_TEST_CUSTOMER_DOCUMENT' => '',
            'PAYMENT_GATEWAY' => 'simulated',
        ] as $key => $value) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $_SERVER[$key] = $value;
        }

        $app = parent::createApplication();
        \Illuminate\Support\Facades\Http::preventStrayRequests(); // qualquer requisição HTTP sem fake explícito falha

        $default = $app['config']->get('database.default');
        $db = (string) $app['config']->get("database.connections.{$default}.database");
        $safe = $default === 'sqlite' && ($db === ':memory:' || str_starts_with($db, sys_get_temp_dir()));

        if (! $safe) {
            throw new \RuntimeException(
                "Teste bloqueado: conexão '{$default}' (banco '{$db}') não é SQLite em memória/temporário. ".
                'Nenhuma consulta foi feita. Verifique o <env force="true"> do phpunit.xml.'
            );
        }

        return $app;
    }
}

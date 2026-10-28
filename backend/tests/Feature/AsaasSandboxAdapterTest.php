<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Breed;
use App\Models\Cow;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Services\Payments\Asaas\AsaasConfig;
use App\Services\Payments\Asaas\AsaasConfigurationException;
use App\Services\Payments\Asaas\AsaasPixGateway;
use App\Services\Payments\GatewayRejected;
use App\Services\Payments\GatewayUncertain;
use App\Services\Payments\PixGateway;
use App\Services\Payments\PixPaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\AsaasFakeServer;
use Tests\TestCase;

/**
 * Adaptador do Asaas SANDBOX testado só com respostas HTTP falsas (AsaasFakeServer).
 * TestCase::createApplication() ativa Http::preventStrayRequests(): qualquer requisição sem fake falha.
 */
class AsaasSandboxAdapterTest extends TestCase
{
    use RefreshDatabase;

    private const FAKE_KEY = 'CHAVE-FALSA-SOMENTE-TESTE';
    private const REF = 'BNR-ABCDEFGH';

    // ───────────── helpers ─────────────

    private function configure(array $override = []): void
    {
        config([
            'services.asaas' => array_replace_recursive([
                'env' => 'sandbox', 'url' => AsaasConfig::SANDBOX_URL, 'key' => self::FAKE_KEY, 'sandbox_authorized' => true, 'timeout' => 5,
                'test_customer' => ['id' => 'cus_TESTE0001', 'name' => '', 'document' => ''],
                'budget' => ['customer_create' => 1, 'customer_list' => 2, 'payment_create' => 1, 'qr' => 2, 'payment_get' => 5, 'payment_list' => 2],
            ], $override),
            'boinarede.payment_gateway' => 'asaas_sandbox',
        ]);
        $this->app->forgetInstance(PixGateway::class);
        $this->app->forgetInstance(PixPaymentService::class);
    }

    private function createCustomerConfig(array $budget = []): void
    {
        $this->configure(['test_customer' => ['id' => '', 'name' => 'Cliente de Teste Ficticio', 'document' => '00000000000'], 'budget' => $budget]);
    }

    private function gw(): AsaasPixGateway
    {
        $g = app(PixGateway::class);
        $this->assertInstanceOf(AsaasPixGateway::class, $g);

        return $g;
    }

    private function create(?AsaasPixGateway $g = null, float $amount = 3900.0, string $ref = self::REF)
    {
        return ($g ?? $this->gw())->createPixCharge($ref, $amount, now()->addDays(3));
    }

    // ───────────── configuração: falha fechado ─────────────

    public static function invalidConfigs(): array
    {
        return [
            'ambiente de produção' => [['env' => 'production']],
            'ambiente vazio' => [['env' => '']],
            'url de produção' => [['url' => 'https://api.asaas.com/v3']],
            'url com barra final' => [['url' => AsaasConfig::SANDBOX_URL.'/']],
            'url http' => [['url' => 'http://sandbox.asaas.com/api/v3']],
            'url parecida (host falso)' => [['url' => 'https://sandbox.asaas.com.evil.example/api/v3']],
            'url desconhecida' => [['url' => 'https://exemplo.invalid/v3']],
            'chave ausente' => [['key' => '']],
            'janela não autorizada' => [['sandbox_authorized' => false]],
            'sem cliente de teste' => [['test_customer' => ['id' => '', 'name' => '', 'document' => '']]],
            'documento com tamanho inválido' => [['test_customer' => ['id' => '', 'name' => 'Teste', 'document' => '123']]],
            'id de cliente em formato estranho' => [['test_customer' => ['id' => '../customers']]],
            'orçamento ausente' => [['budget' => ['qr' => null]]],
            'orçamento não numérico' => [['budget' => ['payment_get' => 'muitos']]],
            'orçamento negativo' => [['budget' => ['payment_get' => '-1']]],
            'timeout fora do intervalo' => [['timeout' => 0]],
        ];
    }

    #[DataProvider('invalidConfigs')]
    public function test_configuracao_incompleta_ou_ambigua_nao_ativa_o_adaptador(array $override): void
    {
        Http::fake();
        $this->configure($override);

        try {
            app(PixGateway::class);
            $this->fail('O adaptador foi ativado com configuração inválida.');
        } catch (AsaasConfigurationException $e) {
            $this->assertStringNotContainsString(self::FAKE_KEY, $e->getMessage());
        }
        Http::assertNothingSent();
    }

    public function test_gateway_desconhecido_falha_fechado(): void
    {
        config(['boinarede.payment_gateway' => 'asaas_producao']);
        $this->app->forgetInstance(PixGateway::class);

        $this->expectException(\RuntimeException::class);
        app(PixGateway::class);
    }

    public function test_padrao_e_simulado_e_o_ambiente_de_teste_nao_carrega_segredos_do_container(): void
    {
        $this->assertSame('simulated', config('boinarede.payment_gateway'));
        $this->assertInstanceOf(\App\Services\Payments\SimulatedPixGateway::class, app(PixGateway::class));
        foreach (['key', 'webhook_token', 'url', 'env'] as $k) {
            $this->assertSame('', (string) config("services.asaas.{$k}"), "services.asaas.{$k} não deveria vir do ambiente real");
        }
    }

    // ───────────── cobrança: caminho feliz e limites ─────────────

    public function test_cria_cobranca_pix_com_requisicoes_contabilizadas_sem_expor_a_chave(): void
    {
        $logged = [];
        Log::shouldReceive('info')->andReturnUsing(function ($msg, $ctx = []) use (&$logged) {
            $logged[] = json_encode([$msg, $ctx]);
        });
        $srv = AsaasFakeServer::install();
        $this->configure();

        $c = $this->create();

        $this->assertSame(['POST /payments', 'GET /payments/pay_T000001/pixQrCode'], array_map(fn ($e) => $e['method'].' '.$e['path'], $srv->log));
        $this->assertSame(self::FAKE_KEY, $srv->log[0]['key']); // a chave só vai no cabeçalho
        $this->assertSame(['customer' => 'cus_TESTE0001', 'billingType' => 'PIX', 'value' => 3900.0, 'dueDate' => now()->addDays(3)->format('Y-m-d'),
            'externalReference' => self::REF, 'description' => 'Pedido de teste '.self::REF], $srv->log[0]['body']);
        $this->assertSame('pay_T000001', $c->id);
        $this->assertSame(self::REF, $c->reference);
        $this->assertSame('PENDING', $c->status);
        $this->assertNotNull($c->pixPayload);
        $this->assertSame(['customer_create' => 0, 'customer_list' => 0, 'payment_create' => 1, 'qr' => 1, 'payment_get' => 0, 'payment_list' => 0], $this->gw()->ledger());
        $this->assertNotEmpty($logged);
        foreach ($logged as $line) {
            $this->assertStringNotContainsString(self::FAKE_KEY, $line);
            $this->assertStringNotContainsString('access_token', $line);
        }
        Http::assertSentCount(2);
    }

    public function test_orcamento_zero_bloqueia_a_criacao_sem_nenhuma_requisicao(): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure(['budget' => ['payment_create' => 0]]);

        $this->expectException(GatewayRejected::class);
        try {
            $this->create();
        } finally {
            $this->assertCount(0, $srv->log);
            Http::assertNothingSent();
        }
    }

    public function test_orcamento_de_consulta_esgotado_vira_inconclusivo_sem_requisicao(): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure(['budget' => ['payment_get' => 1]]);
        $c = $this->create();

        $this->gw()->getCharge($c->id);
        $before = count($srv->log);
        try {
            $this->gw()->getCharge($c->id);
            $this->fail('A segunda consulta deveria ser recusada pelo orçamento.');
        } catch (GatewayUncertain) {
            $this->assertCount($before, $srv->log);
        }
    }

    public function test_so_chama_a_url_exata_do_sandbox_e_nunca_segue_redirecionamento(): void
    {
        $srv = AsaasFakeServer::install(['create' => 'redirect']);
        $this->configure();

        try {
            $this->create();
            $this->fail('Redirecionamento deveria resultar em incerteza.');
        } catch (GatewayUncertain) {
        }
        $this->assertCount(1, $srv->log);
        $this->assertNull($srv->log[0]['foreign']);
        $this->assertSame(0, $srv->count('GET')); // não houve QR nem seguimento do Location
    }

    // ───────────── cobrança: incerteza, sem repetição ─────────────

    public function test_timeout_na_criacao_e_incerto_e_nao_repete(): void
    {
        $srv = AsaasFakeServer::install(['create' => 'timeout']);
        $this->configure();

        $this->expectException(GatewayUncertain::class);
        try {
            $this->create();
        } finally {
            $this->assertSame(1, $srv->count('POST', '/payments'));
        }
    }

    public static function respostasDeErroNaCriacao(): array
    {
        return ['5xx' => ['500'], '4xx' => ['422']];
    }

    #[DataProvider('respostasDeErroNaCriacao')]
    public function test_erro_5xx_ou_4xx_na_criacao_e_incerto_e_nao_reabre_a_criacao(string $mode): void
    {
        $srv = AsaasFakeServer::install(['create' => $mode]);
        $this->configure(['budget' => ['payment_create' => 3]]); // orçamento sobrando: não pode ser ele que impede o segundo POST
        try {
            $this->create();
            $this->fail('Resposta de erro após o envio deve ser incerta.');
        } catch (GatewayUncertain $e) {
            $this->assertStringNotContainsString('sk_secreta', $e->getMessage());
            $this->assertStringNotContainsString(self::FAKE_KEY, $e->getMessage());
        }
        $this->assertSame(1, $srv->count('POST', '/payments'));

        // Segunda tentativa para o mesmo recurso, mesmo com o servidor "corrigido": nenhum novo POST.
        $srv->b['create'] = 'ok';
        try {
            $this->create();
            $this->fail('A segunda criação deveria ser bloqueada.');
        } catch (GatewayUncertain) {
        }
        $this->assertSame(1, $srv->count('POST', '/payments'));
    }

    public function test_orcamento_esgotado_na_criacao_nao_envia_e_libera_a_trava_de_criacao(): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure(['budget' => ['payment_create' => 0]]);
        try {
            $this->create();
        } catch (GatewayRejected) {
        }
        $this->assertCount(0, $srv->log);

        $this->configure(['budget' => ['payment_create' => 1]]); // nada havia sido enviado: pode criar
        $this->create();
        $this->assertSame(1, $srv->count('POST', '/payments'));
    }

    public static function respostasInvalidasNaCriacao(): array
    {
        return [
            'sem id' => [['create_unset' => ['id']]],
            'objeto errado' => [['create_override' => ['object' => 'customer']]],
            'cliente diferente' => [['create_override' => ['customer' => 'cus_OUTRO']]],
            'valor diferente' => [['create_override' => ['value' => 1.0]]],
            'referência diferente' => [['create_override' => ['externalReference' => 'BNR-ZZZZZZZZ']]],
            'sem referência' => [['create_unset' => ['externalReference']]],
            'status desconhecido' => [['create_override' => ['status' => 'MISTERIOSO']]],
            'modalidade boleto' => [['create_override' => ['billingType' => 'BOLETO']]],
            'removida' => [['create_override' => ['deleted' => true]]],
            'moeda diferente' => [['create_override' => ['currency' => 'USD']]],
            'valor não numérico' => [['create_override' => ['value' => '3900']]],
        ];
    }

    #[DataProvider('respostasInvalidasNaCriacao')]
    public function test_resposta_invalida_ou_divergente_na_criacao_nao_associa_a_cobranca(array $behavior): void
    {
        $srv = AsaasFakeServer::install(['create' => 'override'] + $behavior);
        $this->configure();

        try {
            $this->create();
            $this->fail('A cobrança não deveria ser associada ao pedido.');
        } catch (GatewayUncertain) {
        }
        $this->assertSame(1, $srv->count('POST', '/payments'));
        $this->assertSame(0, $srv->count('GET')); // nem QR para cobrança que não foi validada
    }

    public function test_falha_ou_qr_invalido_nao_derruba_a_cobranca_ja_criada(): void
    {
        $srv = AsaasFakeServer::install(['qr' => '500']);
        $this->configure();
        $c = $this->create();
        $this->assertNull($c->pixPayload);
        $this->assertSame('pay_T000001', $c->id);

        $srv->b['qr'] = 'invalid';
        $this->configure(); // novo orçamento na instância; o cache do ledger é por processo
        Http::fake(fn ($r) => $srv->handle($r));
        config(['services.asaas.budget.payment_create' => 3, 'services.asaas.budget.qr' => 5]);
        $this->app->forgetInstance(PixGateway::class);
        $c2 = $this->create(null, 3900.0, 'BNR-ABCDEFG2');
        $this->assertNull($c2->pixPayload);
        $this->assertNull($c2->pixQrImage);
    }

    // ───────────── consulta e reconciliação ─────────────

    public function test_consulta_valida_e_estados_pendente_e_pago(): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure();
        $c = $this->create();

        $this->assertSame('PENDING', $this->gw()->getCharge($c->id)->status);
        $srv->pay($c->id);
        $paid = $this->gw()->getCharge($c->id);
        $this->assertSame('RECEIVED', $paid->status);
        $this->assertSame(3900.0, $paid->value);
        $this->assertSame(self::REF, $paid->reference);
    }

    public static function respostasInvalidasNaConsulta(): array
    {
        return [
            'status desconhecido' => [['get_override' => ['status' => 'MISTERIOSO']]],
            'id diferente' => [['get_override' => ['id' => 'pay_OUTRA']]],
            'cliente diferente' => [['get_override' => ['customer' => 'cus_OUTRO']]],
            'modalidade' => [['get_override' => ['billingType' => 'CREDIT_CARD']]],
            'sem referência' => [['get_unset' => ['externalReference']]],
            'sem valor' => [['get_unset' => ['value']]],
            'removida' => [['get_override' => ['deleted' => true]]],
            'erro 500' => [['get' => '500']],
            'timeout' => [['get' => 'timeout']],
        ];
    }

    #[DataProvider('respostasInvalidasNaConsulta')]
    public function test_consulta_invalida_e_inconclusiva(array $behavior): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure();
        $c = $this->create();
        $srv->b = $behavior;

        $this->expectException(GatewayUncertain::class);
        $this->gw()->getCharge($c->id);
    }

    public function test_divergencia_de_valor_ou_referencia_volta_no_objeto_para_o_servico_marcar_divergente(): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure();
        $c = $this->create();
        $srv->b['get_override'] = ['value' => 1.0, 'externalReference' => 'BNR-OUTRO000'];

        $got = $this->gw()->getCharge($c->id);

        $this->assertSame(1.0, $got->value);
        $this->assertSame('BNR-OUTRO000', $got->reference);
    }

    public function test_busca_por_referencia_so_aceita_candidata_do_cliente_de_teste_e_lista_completa(): void
    {
        $srv = AsaasFakeServer::install(['create' => 'timeout']);
        $this->configure(['budget' => ['payment_list' => 5, 'qr' => 5]]);
        try {
            $this->create();
        } catch (GatewayUncertain) {
        }

        $one = $this->gw()->findByReference(self::REF);
        $this->assertCount(1, $one);
        $this->assertNotNull($one[0]->pixPayload); // QR buscado para a única candidata

        // Outra cobrança com a MESMA referência, mas de outro cliente: externalReference sozinha não é vínculo.
        $srv->b['list_extra'] = [['object' => 'payment', 'id' => 'pay_ALHEIA', 'customer' => 'cus_ALHEIO', 'billingType' => 'PIX', 'value' => 3900.0,
            'status' => 'PENDING', 'externalReference' => self::REF, 'deleted' => false]];
        $this->assertCount(1, $this->gw()->findByReference(self::REF));

        // Duas candidatas do cliente de teste: devolve as duas (o serviço marca divergente).
        $srv->b['list_extra'] = [['object' => 'payment', 'id' => 'pay_DUPLA', 'customer' => 'cus_TESTE0001', 'billingType' => 'PIX', 'value' => 3900.0,
            'status' => 'PENDING', 'externalReference' => self::REF, 'deleted' => false]];
        $this->assertCount(2, $this->gw()->findByReference(self::REF));
    }

    public function test_lista_incompleta_ou_malformada_e_inconclusiva(): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure(['budget' => ['payment_list' => 5]]);
        $this->create();

        $srv->b = ['list_has_more' => true];
        try {
            $this->gw()->findByReference(self::REF);
            $this->fail('Paginação pendente não prova unicidade.');
        } catch (GatewayUncertain) {
        }
        $srv->b = ['list_malformed' => true];
        $this->expectException(GatewayUncertain::class);
        $this->gw()->findByReference(self::REF);
    }

    // ───────────── cliente de teste ─────────────

    public function test_cria_o_cliente_de_teste_uma_vez_com_dados_configurados(): void
    {
        $srv = AsaasFakeServer::install();
        $this->createCustomerConfig(['customer_create' => 1, 'customer_list' => 1, 'payment_create' => 3, 'qr' => 3, 'payment_get' => 3, 'payment_list' => 1]);

        $c = $this->create();
        $this->create(null, 100.0, 'BNR-ABCDEFG2');

        $this->assertSame(1, $srv->count('POST', '/customers'));
        $body = $srv->log[0]['body'];
        $this->assertSame(['name' => 'Cliente de Teste Ficticio', 'cpfCnpj' => '00000000000', 'externalReference' => AsaasConfig::CUSTOMER_REFERENCE, 'notificationDisabled' => true], $body);
        $this->assertSame('cus_NOVO0001', $srv->payments[$c->id]['customer']);
        $this->assertSame('ready', $this->gw()->customerStatus());
    }

    public function test_timeout_na_criacao_do_cliente_preserva_incerteza_e_bloqueia_nova_criacao(): void
    {
        $srv = AsaasFakeServer::install(['customer_create' => 'timeout']);
        $this->createCustomerConfig(['customer_create' => 5, 'payment_create' => 5]);

        try {
            $this->create();
            $this->fail('Deveria recusar: cobrança não enviada.');
        } catch (GatewayRejected) {
        }
        $this->assertSame('uncertain', $this->gw()->customerStatus());
        $this->assertSame(1, $srv->count('POST', '/customers'));
        $this->assertSame(0, $srv->count('POST', '/payments')); // nenhuma cobrança foi enviada

        // Nova tentativa (mesmo com orçamento sobrando): nenhuma requisição, sem outro cliente.
        $before = count($srv->log);
        $this->expectException(GatewayRejected::class);
        try {
            $this->create();
        } finally {
            $this->assertCount($before, $srv->log);
        }
    }

    public function test_resposta_divergente_ou_recusa_na_criacao_do_cliente(): void
    {
        $srv = AsaasFakeServer::install(['customer_create' => 'invalid']);
        $this->createCustomerConfig(['customer_create' => 5, 'payment_create' => 5]);
        try {
            $this->create();
        } catch (GatewayRejected) {
        }
        $this->assertSame('uncertain', $this->gw()->customerStatus()); // pode ter sido criado

        // 4xx: sem contrato verificado não prova que nada foi criado => também incerto (não reabre a criação).
        Setting::write('asaas_sandbox_customer', null);
        $srv->b['customer_create'] = '422';
        $posts = $srv->count('POST', '/customers');
        try {
            $this->create();
        } catch (GatewayRejected) {
        }
        $this->assertSame('uncertain', $this->gw()->customerStatus());
        $this->assertSame($posts + 1, $srv->count('POST', '/customers'));
        try {
            $this->create();
        } catch (GatewayRejected) {
        }
        $this->assertSame($posts + 1, $srv->count('POST', '/customers')); // outra tentativa: nenhum novo POST
        $this->assertSame(0, $srv->count('POST', '/payments'));
    }

    public function test_reconciliacao_do_cliente_incerto_so_le_e_nunca_cria(): void
    {
        $srv = AsaasFakeServer::install(['customer_create' => 'timeout']); // o cliente FOI criado, a resposta se perdeu
        $this->createCustomerConfig(['customer_create' => 1, 'customer_list' => 4, 'payment_create' => 2, 'qr' => 2]);
        try {
            $this->create();
        } catch (GatewayRejected) {
        }

        $srv->b['customer_list'] = '500';
        $this->assertSame('inconclusive', $this->gw()->reconcileCustomer());
        $srv->b['customer_list'] = 'ok';
        $srv->b['customer_list_has_more'] = true;
        $this->assertSame('inconclusive', $this->gw()->reconcileCustomer());
        $srv->b['customer_list_has_more'] = false;
        $this->assertSame('ready', $this->gw()->reconcileCustomer());
        $this->assertSame(1, $srv->count('POST', '/customers')); // jamais criou outro

        $c = $this->create(); // usa o cliente reconciliado
        $this->assertSame('cus_NOVO0001', $srv->payments[$c->id]['customer']);
        $this->assertSame(1, $srv->count('POST', '/customers'));
    }

    public function test_reconciliacao_nao_encontrada_e_ambigua_e_liberacao_explicita(): void
    {
        $srv = AsaasFakeServer::install(['customer_create' => 'timeout_lost']);
        $this->createCustomerConfig(['customer_create' => 2, 'customer_list' => 6, 'payment_create' => 2, 'qr' => 2]);
        try {
            $this->create();
        } catch (GatewayRejected) {
        }

        $this->assertSame('not_found', $this->gw()->reconcileCustomer());
        $this->assertSame('uncertain', $this->gw()->customerStatus()); // não libera sozinho

        $srv->customers = [
            'cus_A' => ['object' => 'customer', 'id' => 'cus_A', 'name' => 'Cliente de Teste Ficticio', 'cpfCnpj' => '00000000000', 'externalReference' => AsaasConfig::CUSTOMER_REFERENCE, 'deleted' => false],
            'cus_B' => ['object' => 'customer', 'id' => 'cus_B', 'name' => 'Cliente de Teste Ficticio', 'cpfCnpj' => '000.000.000-00', 'externalReference' => AsaasConfig::CUSTOMER_REFERENCE, 'deleted' => false],
        ];
        $this->assertSame('ambiguous', $this->gw()->reconcileCustomer());

        $srv->customers = [];
        $this->assertTrue($this->gw()->releaseUncertainCustomer());
        $this->assertSame('none', $this->gw()->customerStatus());
    }

    public static function listasNaoVaziasSemCorrespondenciaEstrita(): array
    {
        $base = ['object' => 'customer', 'id' => 'cus_X', 'name' => 'Cliente de Teste Ficticio', 'cpfCnpj' => '00000000000', 'externalReference' => AsaasConfig::CUSTOMER_REFERENCE, 'deleted' => false];

        return [
            'referência certa, nome divergente' => [[array_replace($base, ['name' => 'Outro Nome'])]],
            'referência certa, documento divergente' => [[array_replace($base, ['cpfCnpj' => '11111111111'])]],
            'removido' => [[array_replace($base, ['deleted' => true])]],
            'correspondente mais um item divergente' => [[$base, array_replace($base, ['id' => 'cus_Y', 'name' => 'Outro'])]],
        ];
    }

    #[DataProvider('listasNaoVaziasSemCorrespondenciaEstrita')]
    public function test_liberacao_so_com_lista_literalmente_vazia_nunca_com_item_divergente(array $items): void
    {
        $srv = AsaasFakeServer::install(['customer_create' => 'timeout_lost']);
        $this->createCustomerConfig(['customer_create' => 2, 'customer_list' => 6, 'payment_create' => 2, 'qr' => 2]);
        try {
            $this->create();
        } catch (GatewayRejected) {
        }
        $srv->customers = array_column($items, null, 'id');

        $this->assertSame('ambiguous', $this->gw()->reconcileCustomer());
        $this->assertFalse($this->gw()->releaseUncertainCustomer());
        $this->assertSame('uncertain', $this->gw()->customerStatus());

        $srv->customers = [];
        $srv->b['customer_list_has_more'] = true; // vazia, mas incompleta: não libera
        $this->assertFalse($this->gw()->releaseUncertainCustomer());
        $this->assertSame('uncertain', $this->gw()->customerStatus());

        $srv->b['customer_list_has_more'] = false;
        $this->assertTrue($this->gw()->releaseUncertainCustomer()); // literalmente vazia e completa
    }

    public function test_comando_de_reconciliacao_so_le_e_exige_o_gateway_sandbox(): void
    {
        $srv = AsaasFakeServer::install(['customer_create' => 'timeout']);
        $this->createCustomerConfig(['customer_create' => 1, 'customer_list' => 2, 'payment_create' => 1]);
        try {
            $this->create();
        } catch (GatewayRejected) {
        }

        $this->artisan('asaas:reconcile-customer')->expectsOutputToContain('Resultado: ready')->assertExitCode(0);
        $this->assertSame(1, $srv->count('POST', '/customers'));

        config(['boinarede.payment_gateway' => 'simulated']);
        $this->app->forgetInstance(PixGateway::class);
        $this->artisan('asaas:reconcile-customer')->expectsOutputToContain('Nada foi feito')->assertExitCode(1);
    }

    // ───────────── jornada completa (API) com o Sandbox falso ─────────────

    private function person(string $email): User
    {
        $u = new User(['name' => 'Pessoa '.$email, 'email' => $email, 'password' => 'senha-ficticia-123', 'document' => '12345678909', 'phone' => '34999990000', 'city' => 'Uberaba', 'state' => 'MG']);
        $u->save();

        return $u;
    }

    private function journey(array $serverBehavior = [], array $budget = []): array
    {
        $srv = AsaasFakeServer::install($serverBehavior);
        $this->configure(['budget' => $budget + ['payment_create' => 3, 'qr' => 3, 'payment_get' => 6, 'payment_list' => 3]]);
        $seller = $this->person('vendedor@teste.local');
        $buyer = $this->person('comprador@teste.local');
        $cow = $seller->cows()->make(['title' => 'Novilha Nelore PO', 'breed_id' => Breed::create(['name' => 'Nelore'])->id, 'sex' => 'femea', 'age_months' => 24,
            'weight_kg' => 390, 'purpose' => 'corte', 'price' => 3900, 'city' => 'Uberaba', 'state' => 'MG']);
        $cow->forceFill(['status' => 'active', 'published_at' => now()])->save();
        Sanctum::actingAs($buyer);
        $order = $this->postJson("/api/checkout/{$cow->id}", ['payment_method' => 'pix', 'delivery_method' => 'pickup'])->assertCreated()->json('data');

        return [$srv, $order, $seller, $buyer, $cow];
    }

    private function check(int $orderId, User $as)
    {
        Sanctum::actingAs($as);

        return $this->postJson("/api/my/purchases/{$orderId}/check-payment");
    }

    public function test_jornada_sandbox_confirmada_e_apresentada_como_teste_nao_real(): void
    {
        [$srv, $order, $seller, $buyer, $cow] = $this->journey();

        $this->assertSame('asaas_sandbox', Payment::first()->gateway);
        $this->assertSame('pending', $order['payment']['status']);
        $this->assertNotNull($order['payment']['pix_payload']);
        $this->assertFalse($order['payment']['simulated']);
        $this->assertTrue($order['payment']['sandbox']);
        $this->assertSame('sandbox', $order['payment']['test_mode']);
        $this->assertEqualsWithDelta(3900, $order['payment']['amount'], 0.001);

        // pendente
        $pending = $this->check($order['id'], $buyer)->assertOk()->json();
        $this->assertSame('pending', $pending['check']['result']);
        $this->assertSame('awaiting_payment', $pending['data']['status']);

        // pago no Sandbox falso -> conferência confirma
        $srv->pay(Payment::first()->gateway_id);
        $res = $this->check($order['id'], $buyer)->assertOk()->json();

        $this->assertSame('confirmed', $res['check']['result']);
        $this->assertSame('sandbox', $res['check']['test_mode']);
        $this->assertFalse($res['check']['simulated']);
        $this->assertStringContainsString('SANDBOX', $res['check']['message']);
        $this->assertStringContainsString('não é pagamento real', $res['check']['message']);
        $this->assertSame('asaas_sandbox', $res['data']['payment']['confirmation_source']);
        $this->assertStringContainsString('SANDBOX', collect($res['data']['timeline'])->firstWhere('status', 'paid')['label']);
        $note = collect($res['data']['journey'])->firstWhere('key', 'confirmed')['note'];
        $this->assertStringContainsString('SANDBOX', $note);
        $this->assertStringNotContainsString('SIMULAD', $note);
        $this->assertSame('reserved', $cow->fresh()->status);

        // vendedor: aviso não manda enviar; envio e entrega recusados
        $sellerNote = AppNotification::where('user_id', $seller->id)->where('type', 'payment_confirmed')->first();
        $this->assertStringContainsString('TESTE', $sellerNote->title);
        $this->assertStringContainsString('não envie o animal', $sellerNote->title);
        $buyerNote = AppNotification::where('user_id', $buyer->id)->where('type', 'payment_confirmed')->first();
        $this->assertStringContainsString('SANDBOX', $buyerNote->title);
        Sanctum::actingAs($seller);
        $this->postJson("/api/my/sales/{$order['id']}/ship")->assertStatus(422);
        $this->assertEqualsWithDelta(0, $this->getJson('/api/dashboard')->json('data.stats.total_sold'), 0.001);
        Sanctum::actingAs($buyer);
        $this->postJson("/api/my/purchases/{$order['id']}/confirm-delivery")->assertStatus(422);
        $this->postJson("/api/my/purchases/{$order['id']}/simulate-payment")->assertNotFound(); // só existe no gateway simulado

        // admin: não é receita nem comissão reais
        $admin = $this->person('admin@teste.local');
        $admin->forceFill(['role' => 'admin'])->save();
        Sanctum::actingAs($admin);
        $k = $this->getJson('/api/admin/dashboard')->assertOk()->json('data.kpis');
        $this->assertEqualsWithDelta(0, $k['revenue'], 0.001);
        $this->assertEqualsWithDelta(0, $k['commissions'], 0.001);
        $this->assertEqualsWithDelta(0, $this->getJson('/api/admin/reports')->assertOk()->json('data.summary.revenue'), 0.001);

        $fresh = Order::find($order['id']);
        $this->assertSame('paid', $fresh->status);
        $this->assertSame('not_applicable', $fresh->payout_status); // teste não gera repasse devido
        $this->assertNull($fresh->shipped_at);
        $this->assertNull($fresh->delivered_at);
    }

    public function test_erro_4xx_na_criacao_via_api_fica_incerto_e_outro_clique_nao_faz_novo_post(): void
    {
        [$srv, $order, , $buyer] = $this->journey(['create' => '422'], ['payment_create' => 5]);
        $this->assertSame('uncertain', $order['payment']['status']);
        $this->assertSame(1, $srv->count('POST', '/payments'));

        $srv->b['create'] = 'ok'; // mesmo que o servidor volte a aceitar
        $first = $this->check($order['id'], $buyer)->assertOk()->json();
        $second = $this->check($order['id'], $buyer)->assertOk()->json();

        $this->assertSame('not_found', $first['check']['result']);
        $this->assertSame('not_found', $second['check']['result']);
        $this->assertSame('uncertain', $second['data']['payment']['status']);
        $this->assertSame(1, $srv->count('POST', '/payments')); // reconciliar só lê
    }

    public function test_erro_4xx_na_criacao_do_cliente_via_api_nao_reabre_a_criacao(): void
    {
        $srv = AsaasFakeServer::install(['customer_create' => '422']);
        $this->createCustomerConfig(['customer_create' => 5, 'payment_create' => 5, 'payment_list' => 5]);
        $seller = $this->person('vendedor@teste.local');
        $buyer = $this->person('comprador@teste.local');
        $cow = $seller->cows()->make(['title' => 'Novilha Nelore PO', 'breed_id' => Breed::create(['name' => 'Nelore'])->id, 'sex' => 'femea', 'age_months' => 24,
            'weight_kg' => 390, 'purpose' => 'corte', 'price' => 3900, 'city' => 'Uberaba', 'state' => 'MG']);
        $cow->forceFill(['status' => 'active', 'published_at' => now()])->save();
        Sanctum::actingAs($buyer);
        $order = $this->postJson("/api/checkout/{$cow->id}", ['payment_method' => 'pix', 'delivery_method' => 'pickup'])->assertCreated()->json('data');

        $this->assertSame(1, $srv->count('POST', '/customers'));
        $this->check($order['id'], $buyer);
        $this->check($order['id'], $buyer);
        $this->assertSame(1, $srv->count('POST', '/customers'));
        $this->assertSame(0, $srv->count('POST', '/payments'));
        $this->assertSame('uncertain', $this->gw()->customerStatus());
    }

    // ───────────── orçamento: reserva fail-closed e regressão da leitura-e-gravação ─────────────

    public function test_reserva_do_orcamento_nao_depende_de_leitura_defasada(): void
    {
        // Simula outro processo: a LEITURA do contador devolve sempre 0 (defasada), mas o incremento é real.
        // A implementação antiga (get + forever) nunca via o teto e enviava tudo; a atual reserva por incremento.
        Cache::extend('defasado', fn () => Cache::repository(new class extends \Illuminate\Cache\ArrayStore {
            private bool $defasado = true;

            public function get($key)
            {
                return $this->defasado && str_starts_with($key, 'asaas:ledger:') ? 0 : parent::get($key);
            }

            public function increment($key, $value = 1)
            {
                $this->defasado = false; // o incremento é do "servidor" do cache e enxerga o valor real
                try {
                    return parent::increment($key, $value);
                } finally {
                    $this->defasado = true;
                }
            }
        }));
        config(['cache.stores.defasado' => ['driver' => 'defasado'], 'cache.default' => 'defasado']);
        $srv = AsaasFakeServer::install();
        $this->configure(['budget' => ['payment_get' => 2]]);
        $c = $this->create();

        $enviadas = 0;
        for ($i = 0; $i < 6; $i++) {
            try {
                $this->gw()->getCharge($c->id);
                $enviadas++;
            } catch (GatewayUncertain) {
            }
        }

        $this->assertSame(2, $enviadas);
        $this->assertSame(2, $srv->count('GET', '/payments/'.$c->id) - $srv->count('GET', '/payments/'.$c->id.'/pixQrCode'));
    }

    public function test_falha_ou_retorno_invalido_do_cache_nao_envia_nada(): void
    {
        foreach (['excecao', 'falso'] as $modo) {
            $driver = 'quebrado_'.$modo;
            Cache::extend($driver, fn () => Cache::repository(new class($modo) extends \Illuminate\Cache\ArrayStore {
                public function __construct(private string $modo)
                {
                    parent::__construct();
                }

                public function increment($key, $value = 1)
                {
                    if (str_starts_with($key, 'asaas:ledger:')) {
                        return $this->modo === 'excecao' ? throw new \RuntimeException('cache fora do ar') : false;
                    }

                    return parent::increment($key, $value);
                }
            }));
            config(['cache.stores.'.$driver => ['driver' => $driver], 'cache.default' => $driver]);
            $srv = AsaasFakeServer::install();
            $this->configure(['budget' => ['payment_create' => 5, 'payment_get' => 5]]);

            try {
                $this->create();
                $this->fail('Sem contador confiável, nada pode ser enviado.');
            } catch (GatewayRejected) {
            }
            $this->assertCount(0, $srv->log, $modo);
        }
    }

    public function test_cache_sem_contador_atomico_entre_processos_nao_ativa_o_adaptador_fora_dos_testes(): void
    {
        Http::fake();
        $this->configure();
        AsaasConfig::fromConfig(); // em teste, o driver array é aceito

        $this->app['env'] = 'production';
        foreach (['array', 'file'] as $driver) {
            config(['cache.default' => $driver, 'cache.stores.'.$driver.'.driver' => $driver]);
            try {
                AsaasConfig::fromConfig();
                $this->fail("O driver {$driver} não deveria ser aceito.");
            } catch (AsaasConfigurationException $e) {
                $this->assertStringContainsString('atômico', $e->getMessage());
            }
        }
        config(['cache.default' => 'database', 'cache.stores.database.driver' => 'database']);
        $this->assertInstanceOf(AsaasConfig::class, AsaasConfig::fromConfig());
        Http::assertNothingSent();
    }

    public function test_orcamento_esgotado_mantem_o_contador_no_limite(): void
    {
        $srv = AsaasFakeServer::install();
        $this->configure(['budget' => ['payment_get' => 2]]);
        $c = $this->create();

        for ($i = 0; $i < 5; $i++) {
            try {
                $this->gw()->getCharge($c->id);
            } catch (GatewayUncertain) {
            }
        }

        $this->assertSame(2, $srv->count('GET', '/payments/'.$c->id) - $srv->count('GET', '/payments/'.$c->id.'/pixQrCode'));
        $this->assertSame(2, $this->gw()->ledger()['payment_get']);
    }

    public function test_preview_do_checkout_informa_modo_sandbox(): void
    {
        [, , , $buyer, $cow] = $this->journey();
        Sanctum::actingAs($buyer);
        $cow2 = $cow->replicate(['status', 'published_at']);
        $cow2->forceFill(['status' => 'active', 'title' => 'Outra'])->save();

        $this->getJson("/api/checkout/{$cow2->id}")->assertOk()->assertJsonPath('data.gateway_mode', 'sandbox')->assertJsonPath('data.simulated_gateway', false);
    }

    public function test_timeout_na_criacao_via_api_reconcilia_sem_criar_outra_cobranca(): void
    {
        [$srv, $order, , $buyer] = $this->journey(['create' => 'timeout']);
        $this->assertSame('uncertain', $order['payment']['status']);
        $this->assertNull($order['payment']['pix_payload']);
        $this->assertSame(1, $srv->count('POST', '/payments'));

        $res = $this->check($order['id'], $buyer)->assertOk()->json();

        $this->assertSame('pending', $res['check']['result']);
        $this->assertSame('pending', $res['data']['payment']['status']);
        $this->assertSame(1, $srv->count('POST', '/payments')); // nenhuma segunda criação
        $this->assertNotNull($res['data']['payment']['pix_payload']);
        $this->assertSame('awaiting_payment', $res['data']['status']);
    }

    public function test_timeout_sem_cobranca_localizada_continua_incerto_via_api(): void
    {
        [$srv, $order, , $buyer] = $this->journey(['create' => 'timeout_lost']);

        $res = $this->check($order['id'], $buyer)->json();

        $this->assertSame('not_found', $res['check']['result']);
        $this->assertSame('uncertain', $res['data']['payment']['status']);
        $this->assertSame(1, $srv->count('POST', '/payments'));
    }

    public function test_divergencia_status_desconhecido_e_erro_de_consulta_nao_confirmam_via_api(): void
    {
        [$srv, $order, , $buyer] = $this->journey();
        $srv->pay(Payment::first()->gateway_id);

        $srv->b['get_override'] = ['value' => 1.0];
        $this->assertSame('divergent', $this->check($order['id'], $buyer)->json('check.result'));

        $srv->b['get_override'] = ['status' => 'MISTERIOSO'];
        $this->assertSame('inconclusive', $this->check($order['id'], $buyer)->json('check.result'));

        $srv->b = ['get' => '500'];
        $this->assertSame('inconclusive', $this->check($order['id'], $buyer)->json('check.result'));

        $srv->b = ['get_override' => ['status' => 'OVERDUE']];
        $this->assertSame('pending', $this->check($order['id'], $buyer)->json('check.result'));
        $this->assertSame('awaiting_payment', Order::find($order['id'])->status);
    }

    public function test_pedido_criado_pelo_gateway_simulado_nao_e_conferido_no_sandbox(): void
    {
        [$srv, $order, , $buyer] = $this->journey();
        Payment::query()->update(['gateway' => 'simulated']);
        $before = count($srv->log);

        $res = $this->check($order['id'], $buyer)->assertOk()->json();

        $this->assertSame('inconclusive', $res['check']['result']);
        $this->assertSame('awaiting_payment', $res['data']['status']);
        $this->assertCount($before, $srv->log); // nenhuma requisição ao Sandbox
    }

    public function test_sem_repeticao_automatica_o_orcamento_total_nao_estoura_na_jornada(): void
    {
        [$srv, $order, , $buyer] = $this->journey([], ['payment_get' => 2]);
        $srv->pay(Payment::first()->gateway_id);

        $this->assertSame('confirmed', $this->check($order['id'], $buyer)->json('check.result'));
        // Contagem final: 1 criação + 1 QR + 1 consulta (a confirmação não gera requisições extras).
        $this->assertSame(1, $srv->count('POST', '/payments'));
        $this->assertSame(1, $srv->count('GET', '/payments/pay_T000001/pixQrCode'));
        $this->assertSame(1, $srv->count('GET', '/payments/pay_T000001') - $srv->count('GET', '/payments/pay_T000001/pixQrCode'));
    }
}

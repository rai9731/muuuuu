<?php

namespace Tests\Feature;

use App\Models\Breed;
use App\Models\Cow;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payments\GatewayRejected;
use App\Services\Payments\GatewayUncertain;
use App\Services\Payments\PixCharge;
use App\Services\Payments\PixGateway;
use App\Services\Payments\SimulatedPixGateway;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Entrega 01: jornada Pix com gateway SIMULADO. Nenhum teste fala com o Asaas.
 */
class PixJourneyTest extends TestCase
{
    use RefreshDatabase;

    private User $seller;
    private User $buyer;
    private Breed $breed;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seller = $this->person('vendedor@teste.local');
        $this->buyer = $this->person('comprador@teste.local');
        $this->breed = Breed::create(['name' => 'Nelore']);
    }

    private function person(string $email): User
    {
        $u = new User(['name' => 'Pessoa '.$email, 'email' => $email, 'password' => 'senha-fictícia-123', 'document' => '12345678909', 'phone' => '34999990000', 'city' => 'Uberaba', 'state' => 'MG']);
        $u->save();

        return $u;
    }

    private function cow(string $title, float $price): Cow
    {
        $cow = $this->seller->cows()->make([
            'title' => $title, 'breed_id' => $this->breed->id, 'sex' => 'femea', 'age_months' => 24, 'weight_kg' => 390,
            'purpose' => 'corte', 'price' => $price, 'city' => 'Uberaba', 'state' => 'MG',
        ]);
        $cow->forceFill(['status' => 'active', 'published_at' => now()])->save();

        return $cow;
    }

    private function buy(Cow $cow, array $extra = [], ?User $as = null)
    {
        Sanctum::actingAs($as ?? $this->buyer);

        return $this->postJson("/api/checkout/{$cow->id}", ['payment_method' => 'pix', 'delivery_method' => 'pickup'] + $extra);
    }

    /** Gateway de teste com comportamento programável e contagem de chamadas. */
    private function fakeGateway(array $behavior = []): object
    {
        $fake = new class($behavior) implements PixGateway {
            public int $creates = 0;
            public array $charges = [];
            public function __construct(public array $b) {}
            public function source(): string { return 'simulation'; }
            public function createPixCharge(string $reference, float $amount, CarbonInterface $dueDate): PixCharge
            {
                $this->creates++;
                $c = new PixCharge('fake_'.$this->creates, $reference, $amount, 'PENDING', 'PIX-'.$reference);
                if (($this->b['create'] ?? null) === 'timeout') {
                    $this->charges[$c->id] = $c; // a cobrança PODE ter sido criada, mas a resposta se perde
                    throw new GatewayUncertain('timeout');
                }
                if (($this->b['create'] ?? null) === 'timeout_not_created') {
                    throw new GatewayUncertain('timeout');
                }
                if (($this->b['create'] ?? null) === 'rejected') {
                    throw new GatewayRejected('recusada');
                }
                $this->charges[$c->id] = $c;

                return $c;
            }
            public function findByReference(string $reference): array
            {
                if (($this->b['find'] ?? null) === 'error') { throw new GatewayUncertain('rede'); }
                return array_values(array_filter($this->charges, fn ($c) => $c->reference === $reference));
            }
            public function getCharge(string $id): PixCharge
            {
                if (($this->b['get'] ?? null) === 'error') { throw new GatewayUncertain('rede'); }
                $c = $this->charges[$id];
                if ($o = $this->b['override'] ?? null) {
                    return new PixCharge($o['id'] ?? $c->id, $o['reference'] ?? $c->reference, $o['value'] ?? $c->value, $o['status'] ?? $c->status, $c->pixPayload);
                }

                return $c;
            }
            public function pay(string $id): void
            {
                $c = $this->charges[$id];
                $this->charges[$id] = new PixCharge($c->id, $c->reference, $c->value, 'RECEIVED', $c->pixPayload);
            }
        };
        $this->app->instance(PixGateway::class, $fake);
        $this->app->forgetInstance(\App\Services\Payments\PixPaymentService::class);

        return $fake;
    }

    private function check(Order|int $order)
    {
        Sanctum::actingAs($this->buyer);

        return $this->postJson('/api/my/purchases/'.($order instanceof Order ? $order->id : $order).'/check-payment');
    }

    // ───────────── identidade e preço ─────────────

    public function test_dois_anuncios_distintos_geram_pedidos_e_cobrancas_distintos_sem_troca_de_valor(): void
    {
        $a = $this->cow('Novilha Nelore PO', 3900);
        $b = $this->cow('Touro Angus reprodutor', 12500);

        $oa = $this->buy($a)->assertCreated()->json('data');
        $ob = $this->buy($b)->assertCreated()->json('data');

        $this->assertSame($a->id, $oa['cow']['id']);
        $this->assertSame($b->id, $ob['cow']['id']);
        $this->assertSame(3900.0, (float) $oa['price']);
        $this->assertSame(12500.0, (float) $ob['price']);
        $this->assertEqualsWithDelta(3900, $oa['payment']['amount'], 0.001);
        $this->assertEqualsWithDelta(12500, $ob['payment']['amount'], 0.001);
        $this->assertNotSame($oa['payment']['pix_payload'], $ob['payment']['pix_payload']);
        // Pix da cobrança correspondente: o payload carrega a referência do PRÓPRIO pedido.
        $this->assertStringContainsString($oa['code'], $oa['payment']['pix_payload']);
        $this->assertStringContainsString($ob['code'], $ob['payment']['pix_payload']);
    }

    public function test_preco_adulterado_no_navegador_e_ignorado(): void
    {
        $cow = $this->cow('Novilha Nelore PO', 3900);

        $data = $this->buy($cow, ['price' => 1, 'total' => 1, 'amount' => 1, 'cow_id' => 999, 'payment' => ['amount' => 1]])->assertCreated()->json('data');

        $this->assertSame(3900.0, (float) $data['price']);
        $this->assertEqualsWithDelta(3900.0, $data['payment']['amount'], 0.001);
        $this->assertSame($cow->id, $data['cow']['id']);
    }

    public function test_preview_so_oferece_pix(): void
    {
        $cow = $this->cow('Novilha Nelore PO', 3900);
        Sanctum::actingAs($this->buyer);

        $this->getJson("/api/checkout/{$cow->id}")->assertOk()->assertJsonPath('data.payment_methods', ['pix'])->assertJsonPath('data.simulated_gateway', true);
        $this->postJson("/api/checkout/{$cow->id}", ['payment_method' => 'boleto', 'delivery_method' => 'pickup'])->assertStatus(422);
    }

    // ───────────── clique repetido e criação incerta ─────────────

    public function test_clique_repetido_nao_cria_pedido_nem_cobranca_duplicados(): void
    {
        $fake = $this->fakeGateway();
        $cow = $this->cow('Novilha Nelore PO', 3900);

        $first = $this->buy($cow)->assertCreated()->json('data');
        $second = $this->buy($cow)->assertOk()->json('data');

        $this->assertSame($first['id'], $second['id']);
        $this->assertSame(1, Order::count());
        $this->assertSame(1, Payment::count());
        $this->assertSame(1, $fake->creates);
    }

    public function test_timeout_na_criacao_fica_incerto_e_nao_repete_a_criacao(): void
    {
        $fake = $this->fakeGateway(['create' => 'timeout']);
        $cow = $this->cow('Novilha Nelore PO', 3900);

        $order = $this->buy($cow)->assertCreated()->json('data');
        $this->assertSame('uncertain', $order['payment']['status']);
        $this->assertNull($order['payment']['pix_payload']);
        $this->assertSame('warning', collect($order['journey'])->firstWhere('key', 'charge')['state']);

        // Recarga da página e novo clique em "Comprar agora" não criam outra cobrança.
        $this->buy($cow)->assertOk();
        $this->assertSame(1, $fake->creates);

        // Conferir localiza pela referência e vincula SEM criar nova cobrança.
        $res = $this->check($order['id'])->assertOk()->json();
        $this->assertSame('pending', $res['check']['result']);
        $this->assertSame('pending', $res['data']['payment']['status']);
        $this->assertNotNull($res['data']['payment']['pix_payload']);
        $this->assertSame(1, $fake->creates);
    }

    public function test_timeout_sem_cobranca_localizada_continua_incerto_e_nao_cria_outra(): void
    {
        $fake = $this->fakeGateway(['create' => 'timeout_not_created']);
        $cow = $this->cow('Novilha Nelore PO', 3900);
        $order = $this->buy($cow)->assertCreated()->json('data');

        $res = $this->check($order['id'])->json();

        $this->assertSame('not_found', $res['check']['result']);
        $this->assertSame('uncertain', $res['data']['payment']['status']);
        $this->assertSame('awaiting_payment', $res['data']['status']);
        $this->assertSame(1, $fake->creates);
    }

    public function test_falha_de_rede_na_reconciliacao_e_inconclusiva(): void
    {
        $fake = $this->fakeGateway(['create' => 'timeout', 'find' => 'error']);
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->assertCreated()->json('data');

        $res = $this->check($order['id'])->json();

        $this->assertSame('inconclusive', $res['check']['result']);
        $this->assertSame('uncertain', $res['data']['payment']['status']);
        $this->assertSame(1, $fake->creates);
    }

    public function test_recusa_definitiva_permite_tentativa_explicita_e_nunca_automatica(): void
    {
        $fake = $this->fakeGateway(['create' => 'rejected']);
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->assertCreated()->json('data');
        $this->assertSame('preparing', $order['payment']['status']);
        $this->assertSame(1, $fake->creates);

        $fake->b['create'] = null; // gateway volta a responder
        $res = $this->check($order['id'])->json();

        $this->assertSame('pending', $res['check']['result']);
        $this->assertSame(2, $fake->creates);
    }

    // ───────────── conferência ─────────────

    public function test_conferencia_pendente_nao_confirma(): void
    {
        $this->fakeGateway();
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');

        $res = $this->check($order['id'])->assertOk()->json();

        $this->assertSame('pending', $res['check']['result']);
        $this->assertSame('awaiting_payment', $res['data']['status']);
        $this->assertNull($res['data']['paid_at']);
        $this->assertSame('todo', collect($res['data']['journey'])->firstWhere('key', 'confirmed')['state']);
    }

    public function test_simular_pagamento_sozinho_nao_confirma_o_pedido(): void
    {
        $cow = $this->cow('Novilha Nelore PO', 3900);
        $order = $this->buy($cow)->json('data');

        $this->postJson("/api/my/purchases/{$order['id']}/simulate-payment")->assertOk();

        $this->assertSame('awaiting_payment', Order::find($order['id'])->status);
        $this->assertSame('pending', Payment::first()->status);
    }

    public function test_conferencia_valida_confirma_como_simulacao_e_nao_vende_o_animal(): void
    {
        $cow = $this->cow('Novilha Nelore PO', 3900);
        $order = $this->buy($cow)->json('data');
        $this->postJson("/api/my/purchases/{$order['id']}/simulate-payment")->assertOk();

        $res = $this->check($order['id'])->assertOk()->json();

        $this->assertSame('confirmed', $res['check']['result']);
        $this->assertSame('paid', $res['data']['status']);
        $this->assertSame('approved', $res['data']['payment']['status']);
        $this->assertSame('simulation', $res['data']['payment']['confirmation_source']);
        $this->assertStringContainsString('SIMULADA', collect($res['data']['journey'])->firstWhere('key', 'confirmed')['note']);
        $this->assertSame('reserved', $cow->fresh()->status); // sem venda nem mudança de estoque por pagamento simulado
    }

    public function test_confirmar_duas_vezes_nao_duplica_a_transicao_nem_as_notificacoes(): void
    {
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $this->postJson("/api/my/purchases/{$order['id']}/simulate-payment");
        $this->check($order['id'])->assertOk();
        $paidAt = Order::find($order['id'])->paid_at;
        $count = \App\Models\AppNotification::where('type', 'payment_confirmed')->count();

        $again = $this->check($order['id'])->assertOk()->json();

        $this->assertSame('confirmed', $again['check']['result']);
        $this->assertEquals($paidAt, Order::find($order['id'])->paid_at);
        $this->assertSame($count, \App\Models\AppNotification::where('type', 'payment_confirmed')->count());
    }

    public function test_valor_divergente_nao_confirma(): void
    {
        $fake = $this->fakeGateway();
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $id = Payment::first()->gateway_id;
        $fake->pay($id);
        $fake->b['override'] = ['value' => 1.0];

        $res = $this->check($order['id'])->json();

        $this->assertSame('divergent', $res['check']['result']);
        $this->assertSame('awaiting_payment', $res['data']['status']);
        $this->assertSame('divergent', $res['data']['payment']['status']);
        $this->assertNull($res['data']['payment']['pix_payload']);
    }

    public function test_referencia_ou_id_divergente_nao_confirma(): void
    {
        $fake = $this->fakeGateway();
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $fake->pay(Payment::first()->gateway_id);

        $fake->b['override'] = ['reference' => 'BNR-OUTRO'];
        $this->assertSame('divergent', $this->check($order['id'])->json('check.result'));

        $fake->b['override'] = ['id' => 'fake_999'];
        $this->assertSame('divergent', $this->check($order['id'])->json('check.result'));
        $this->assertSame('awaiting_payment', Order::find($order['id'])->status);
    }

    public function test_falha_de_rede_na_conferencia_e_inconclusiva_e_nao_confirma(): void
    {
        $fake = $this->fakeGateway();
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $fake->pay(Payment::first()->gateway_id);
        $fake->b['get'] = 'error';

        $res = $this->check($order['id'])->assertOk()->json();

        $this->assertSame('inconclusive', $res['check']['result']);
        $this->assertSame('awaiting_payment', $res['data']['status']);
    }

    public function test_status_nao_pago_do_gateway_nao_confirma(): void
    {
        $fake = $this->fakeGateway();
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $fake->b['override'] = ['status' => 'OVERDUE'];

        $this->assertSame('pending', $this->check($order['id'])->json('check.result'));
        $this->assertSame('awaiting_payment', Order::find($order['id'])->status);
    }

    public function test_divergencia_anterior_e_reavaliada_quando_deixa_de_existir(): void
    {
        $fake = $this->fakeGateway();
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $fake->pay(Payment::first()->gateway_id);
        $fake->b['override'] = ['value' => 1.0];
        $this->assertSame('divergent', $this->check($order['id'])->json('check.result'));

        $fake->b['override'] = null;

        $this->assertSame('confirmed', $this->check($order['id'])->json('check.result'));
    }

    // ───────────── regra A: preço anunciado = total pago; comissão sai do repasse ─────────────

    public function test_regra_a_comprador_paga_o_preco_anunciado_e_comissao_reduz_o_repasse(): void
    {
        $cow = $this->cow('Novilha Nelore PO', 3900);
        Sanctum::actingAs($this->buyer);

        $preview = $this->getJson("/api/checkout/{$cow->id}")->assertOk()->json('data');
        $this->assertEqualsWithDelta(3900, $preview['price'], 0.001);
        $this->assertEqualsWithDelta(3900, $preview['total'], 0.001);
        $this->assertEqualsWithDelta(195, $preview['platform_fee'], 0.001);
        $this->assertEqualsWithDelta(3705, $preview['seller_amount'], 0.001);

        $order = $this->buy($cow)->assertCreated()->json('data');
        foreach (['price' => 3900, 'total' => 3900, 'platform_fee' => 195, 'seller_amount' => 3705] as $k => $v) {
            $this->assertEqualsWithDelta($v, $order[$k], 0.001, $k);
        }
        $this->assertEqualsWithDelta(3900, $order['payment']['amount'], 0.001);
        $this->assertEqualsWithDelta(5.0, $order['commission_percent'], 0.001);
        $this->assertEqualsWithDelta($cow->price, $order['total'], 0.001); // vitrine = checkout
    }

    // ───────────── confirmação simulada: mensagens, avisos e receita ─────────────

    public function test_confirmacao_simulada_e_rotulada_e_nao_instrui_envio_nem_vira_receita(): void
    {
        $this->cow('Outra', 1000); // ruído
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $this->postJson("/api/my/purchases/{$order['id']}/simulate-payment")->assertOk();

        $res = $this->check($order['id'])->assertOk()->json();

        $this->assertSame('confirmed', $res['check']['result']);
        $this->assertTrue($res['check']['simulated']);
        $this->assertStringContainsString('SIMULADA', $res['check']['message']);
        $this->assertStringContainsString('SIMULADO', collect($res['data']['timeline'])->firstWhere('status', 'paid')['label']);

        $sellerNote = \App\Models\AppNotification::where('user_id', $this->seller->id)->where('type', 'payment_confirmed')->first();
        $this->assertStringContainsString('SIMULADO', $sellerNote->title);
        $this->assertStringContainsString('não envie o animal', $sellerNote->title); // nunca "Pagamento confirmado — envie o animal"
        $buyerNote = \App\Models\AppNotification::where('user_id', $this->buyer->id)->where('type', 'payment_confirmed')->first();
        $this->assertStringContainsString('SIMULADA', $buyerNote->title);

        // Painel do vendedor e do admin: simulação não é receita nem comissão reais.
        Sanctum::actingAs($this->seller);
        $this->assertEqualsWithDelta(0, $this->getJson('/api/dashboard')->json('data.stats.total_sold'), 0.001);
        $admin = $this->person('admin@teste.local');
        $admin->forceFill(['role' => 'admin'])->save();
        Sanctum::actingAs($admin);
        $k = $this->getJson('/api/admin/dashboard')->assertOk()->json('data.kpis');
        $this->assertEqualsWithDelta(0, $k['revenue'], 0.001);
        $this->assertEqualsWithDelta(0, $k['commissions'], 0.001);
        $this->assertEqualsWithDelta(0, $this->getJson('/api/admin/reports')->assertOk()->json('data.summary.revenue'), 0.001);
    }

    public function test_pagamento_nao_simulado_continua_contando_como_receita(): void
    {
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        Payment::query()->update(['gateway' => 'asaas']); // marca como não simulado só para exercitar o filtro (nenhuma chamada externa)
        Order::whereKey($order['id'])->update(['status' => 'paid', 'paid_at' => now()]);
        $admin = $this->person('admin@teste.local');
        $admin->forceFill(['role' => 'admin'])->save();
        Sanctum::actingAs($admin);

        $k = $this->getJson('/api/admin/dashboard')->assertOk()->json('data.kpis');

        $this->assertEqualsWithDelta(3900, $k['revenue'], 0.001);
        $this->assertEqualsWithDelta(195, $k['commissions'], 0.001);
    }

    // ───────────── autorização e gateway padrão ─────────────

    public function test_outro_usuario_nao_confere_nem_simula_o_pedido_alheio(): void
    {
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');
        $stranger = $this->person('intruso@teste.local');
        Sanctum::actingAs($stranger);

        $this->postJson("/api/my/purchases/{$order['id']}/check-payment")->assertNotFound();
        $this->postJson("/api/my/purchases/{$order['id']}/simulate-payment")->assertNotFound();
    }

    public function test_gateway_padrao_e_o_simulado_e_marca_pagamento_como_simulado(): void
    {
        $this->assertInstanceOf(SimulatedPixGateway::class, app(PixGateway::class));
        $order = $this->buy($this->cow('Novilha Nelore PO', 3900))->json('data');

        $this->assertTrue($order['payment']['simulated']);
        $this->assertSame('simulated', Payment::first()->gateway);
    }
}

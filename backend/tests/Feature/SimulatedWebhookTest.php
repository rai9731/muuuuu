<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Breed;
use App\Models\Cow;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payments\GatewayUncertain;
use App\Services\Payments\PixCharge;
use App\Services\Payments\PixGateway;
use App\Services\Payments\PixPaymentService;
use App\Services\Payments\SimulatedPixGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Webhook LOCAL e SIMULADO (aviso fictício -> conferência no gateway simulado). Requisições e dados fictícios, SQLite em
 * memória, sem rede, sem Asaas, sem seeder. O aviso nunca confirma por si só.
 */
class SimulatedWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'token-de-teste-fictício';

    private User $seller;

    private User $buyer;

    protected function setUp(): void
    {
        parent::setUp();
        config(['boinarede.simulated_webhook_token' => self::TOKEN]);
        $this->seller = $this->person('vendedor@teste.local');
        $this->buyer = $this->person('comprador@teste.local');
    }

    private function person(string $email): User
    {
        $u = new User(['name' => 'Pessoa '.$email, 'email' => $email, 'password' => 'senha-fictícia-123', 'document' => '12345678909', 'phone' => '34999990000', 'city' => 'Uberaba', 'state' => 'MG']);
        $u->save();

        return $u;
    }

    /** @return array{0:Order,1:Payment} pedido recém-criado pelo checkout (gateway simulado), aguardando pagamento */
    private function order(float $price = 3900): array
    {
        $cow = $this->seller->cows()->make(['title' => 'Novilha Nelore PO', 'breed_id' => Breed::create(['name' => 'Nelore'.random_int(1, 99999)])->id, 'sex' => 'femea',
            'age_months' => 24, 'weight_kg' => 390, 'purpose' => 'corte', 'price' => $price, 'city' => 'Uberaba', 'state' => 'MG']);
        $cow->forceFill(['status' => 'active', 'published_at' => now()])->save();
        Sanctum::actingAs($this->buyer);
        $id = $this->postJson("/api/checkout/{$cow->id}", ['payment_method' => 'pix', 'delivery_method' => 'pickup'])->assertCreated()->json('data.id');
        $order = Order::findOrFail($id);

        return [$order, $order->payment];
    }

    /** Aviso fictício. $over sobrescreve campos de payment. */
    private function notice(Payment $p, Order $o, array $over = [], ?string $token = self::TOKEN)
    {
        $body = ['event' => 'PAYMENT_RECEIVED', 'payment' => $over + ['id' => $p->gateway_id, 'externalReference' => $o->code, 'value' => (float) $p->amount]];
        $headers = $token === null ? [] : ['X-Webhook-Token' => $token];

        return $this->postJson('/api/webhooks/simulated-pix', $body, $headers);
    }

    private function pay(Payment $p): void
    {
        app(SimulatedPixGateway::class)->markReceived($p->gateway_id);
    }

    // ───────────── autenticação ─────────────

    public function test_token_ausente_ou_incorreto_e_recusado_e_nada_muda(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);

        $this->notice($p, $o, [], null)->assertStatus(401);
        $this->notice($p, $o, [], 'token-errado')->assertStatus(401);
        $this->notice($p, $o, [], '')->assertStatus(401);

        $this->assertSame('awaiting_payment', $o->fresh()->status);
        $this->assertSame('pending', $p->fresh()->status);
    }

    public function test_desligado_por_padrao_sem_token_configurado(): void
    {
        [$o, $p] = $this->order();
        config(['boinarede.simulated_webhook_token' => null]);

        $this->notice($p, $o, [], 'qualquer')->assertStatus(404);
        $this->notice($p, $o, [], null)->assertStatus(404);
        $this->assertSame('awaiting_payment', $o->fresh()->status);
    }

    // ───────────── aviso válido + conferência ─────────────

    public function test_aviso_valido_com_pagamento_no_gateway_confirma_como_simulacao(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);

        $r = $this->notice($p, $o)->assertOk()->assertJsonPath('data.result', 'confirmed')->assertJsonPath('data.origin', 'webhook_local_simulado')->assertJsonPath('data.simulated', true);
        $this->assertStringContainsString('não confirma', $r->json('message'));

        $this->assertSame('paid', $o->fresh()->status);
        $this->assertSame('approved', $p->fresh()->status);
        $this->assertSame('simulation', $p->fresh()->confirmation_source);
        $this->assertSame('not_applicable', $o->fresh()->payout_status);
    }

    public function test_conteudo_do_aviso_sozinho_nao_confirma_se_o_gateway_nao_recebeu(): void
    {
        [$o, $p] = $this->order();

        // O aviso afirma pagamento (evento e valor corretos), mas o gateway simulado ainda diz PENDING.
        $this->notice($p, $o)->assertOk()->assertJsonPath('data.result', 'pending');

        $this->assertSame('awaiting_payment', $o->fresh()->status);
        $this->assertSame('pending', $p->fresh()->status);
    }

    public function test_repeticao_do_mesmo_aviso_nao_duplica_transicao_nem_notificacoes(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);

        $this->notice($p, $o)->assertOk()->assertJsonPath('data.result', 'confirmed');
        $paidAt = $o->fresh()->paid_at;
        $notes = AppNotification::where('type', 'payment_confirmed')->count();
        $this->assertSame(2, $notes);

        $this->notice($p, $o)->assertOk()->assertJsonPath('data.result', 'confirmed');
        $this->notice($p, $o)->assertOk();

        $this->assertSame($notes, AppNotification::where('type', 'payment_confirmed')->count());
        $this->assertEquals($paidAt, $o->fresh()->paid_at);
        $this->assertSame('paid', $o->fresh()->status);
    }

    // ───────────── identificação e divergências ─────────────

    public function test_cobranca_ou_pedido_desconhecidos(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);

        $this->notice($p, $o, ['id' => 'sim_pay_inexistente'])->assertStatus(404);
        $this->notice($p, $o, ['id' => $p->gateway_id, 'externalReference' => 'BNR-NAOEXISTE'])->assertStatus(422);
        $this->postJson('/api/webhooks/simulated-pix', ['payment' => ['id' => $p->gateway_id]], ['X-Webhook-Token' => self::TOKEN])->assertStatus(422);
        $this->postJson('/api/webhooks/simulated-pix', [], ['X-Webhook-Token' => self::TOKEN])->assertStatus(422);

        $this->assertSame('awaiting_payment', $o->fresh()->status);
    }

    public function test_aviso_de_outro_pedido_nao_confirma_este(): void
    {
        [$o1, $p1] = $this->order();
        [$o2, $p2] = $this->order(5000);
        $this->pay($p1);
        $this->pay($p2);

        // id da cobrança 1 com a referência do pedido 2
        $this->notice($p1, $o1, ['externalReference' => $o2->code])->assertStatus(422);

        $this->assertSame('awaiting_payment', $o1->fresh()->status);
        $this->assertSame('awaiting_payment', $o2->fresh()->status);
    }

    public function test_valor_do_aviso_divergente_e_recusado(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);

        $this->notice($p, $o, ['value' => 1.00])->assertStatus(422);
        $this->assertSame('awaiting_payment', $o->fresh()->status);
    }

    public function test_divergencia_no_gateway_marca_divergente_e_nao_confirma(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);
        // Aviso coerente, mas o gateway devolve outro valor para a cobrança.
        $d = Cache::get("simgw:charge:{$p->gateway_id}");
        $d['value'] = 1.0;
        Cache::forever("simgw:charge:{$p->gateway_id}", $d);

        $this->notice($p, $o)->assertOk()->assertJsonPath('data.result', 'divergent');

        $this->assertSame('awaiting_payment', $o->fresh()->status);
        $this->assertSame('divergent', $p->fresh()->status);
    }

    // ───────────── falhas ─────────────

    public function test_erro_na_conferencia_nao_confirma(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);
        $this->app->instance(PixGateway::class, new class extends SimulatedPixGateway {
            public function getCharge(string $id): PixCharge
            {
                throw new GatewayUncertain('rede');
            }
        });
        $this->app->forgetInstance(PixPaymentService::class);

        $this->notice($p, $o)->assertStatus(503)->assertJsonPath('data.result', 'inconclusive');

        $this->assertSame('awaiting_payment', $o->fresh()->status);
        $this->assertSame('pending', $p->fresh()->status);
    }

    public function test_erro_na_persistencia_nao_deixa_confirmacao_parcial(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);
        DB::statement("CREATE TRIGGER bloqueia_pago BEFORE UPDATE ON orders WHEN NEW.status = 'paid' BEGIN SELECT RAISE(ABORT, 'falha de gravação'); END");

        $this->notice($p, $o)->assertStatus(500);

        DB::statement('DROP TRIGGER bloqueia_pago');
        $this->assertSame('awaiting_payment', $o->fresh()->status);
        $this->assertNotSame('approved', $p->fresh()->status);
        $this->assertSame(0, AppNotification::where('type', 'payment_confirmed')->count());

        // Reenvio depois que a falha some: agora confirma uma única vez.
        $this->notice($p, $o)->assertOk()->assertJsonPath('data.result', 'confirmed');
        $this->assertSame('paid', $o->fresh()->status);
    }

    // ───────────── caminho manual aprovado continua valendo ─────────────

    public function test_caminho_manual_continua_funcionando_e_o_webhook_depois_nao_duplica(): void
    {
        [$o, $p] = $this->order();
        $this->pay($p);

        Sanctum::actingAs($this->buyer);
        $this->postJson("/api/my/purchases/{$o->id}/check-payment")->assertOk();
        $this->assertSame('paid', $o->fresh()->status);
        $notes = AppNotification::where('type', 'payment_confirmed')->count();

        $this->notice($p, $o)->assertOk()->assertJsonPath('data.result', 'confirmed');
        $this->assertSame($notes, AppNotification::where('type', 'payment_confirmed')->count());
    }

    public function test_so_existe_com_o_gateway_simulado_ativo(): void
    {
        [$o, $p] = $this->order();
        config(['boinarede.payment_gateway' => 'asaas_sandbox']);
        $this->app->forgetInstance(PixGateway::class);
        $this->app->forgetInstance(PixPaymentService::class);

        // Com o Sandbox selecionado (e sem configuração do adaptador), o endpoint não responde: nunca vira webhook do Asaas.
        $this->assertGreaterThanOrEqual(400, $this->notice($p, $o)->getStatusCode());
        $this->assertSame('awaiting_payment', $o->fresh()->status);
    }
}

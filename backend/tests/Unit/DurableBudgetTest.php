<?php

namespace Tests\Unit;

use App\Services\Payments\Asaas\AsaasRefusedException;
use App\Services\Payments\Asaas\DurableBudget;
use Illuminate\Database\SQLiteConnection;
use PHPUnit\Framework\TestCase;

/**
 * DurableBudget em um único processo, arquivo SQLite temporário (sem framework da aplicação, .env, MySQL ou rede).
 * Cobre reserva até o teto, recusa sem alterar o contador, tetos zero, registro ausente/inconsistente e falha de gravação.
 */
class DurableBudgetTest extends TestCase
{
    private string $file;

    private \PDO $pdo;

    private SQLiteConnection $db;

    protected function setUp(): void
    {
        $this->file = sys_get_temp_dir().'/bnr-budget-u-'.bin2hex(random_bytes(4)).'.sqlite';
        $this->pdo = new \PDO('sqlite:'.$this->file, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $this->pdo->exec('CREATE TABLE asaas_request_budget (op varchar(32) NOT NULL PRIMARY KEY, used integer NOT NULL DEFAULT 0, window_id varchar(32) NOT NULL, created_at datetime NULL, updated_at datetime NULL)');
        $this->db = new SQLiteConnection($this->pdo, $this->file, '', ['transaction_mode' => 'DEFERRED']);
        $this->assertTrue(DurableBudget::initialize($this->db));
    }

    protected function tearDown(): void
    {
        @unlink($this->file);
    }

    private function used(string $op): ?int
    {
        $v = $this->pdo->query("SELECT used FROM asaas_request_budget WHERE op = '{$op}'")->fetchColumn();

        return $v === false ? null : (int) $v;
    }

    private function refused(callable $fn, string $needle = ''): string
    {
        try {
            $fn();
        } catch (AsaasRefusedException $e) {
            $needle === '' || $this->assertStringContainsString($needle, $e->getMessage());

            return $e->getMessage();
        }
        $this->fail('A reserva deveria ter sido recusada.');
    }

    public function test_reserva_ate_o_teto_recusa_a_proxima_e_preserva_o_contador(): void
    {
        $b = new DurableBudget($this->db);
        $b->reserve('qr', 2);
        $b->reserve('qr', 2);
        $this->assertSame(2, $this->used('qr'));

        $this->refused(fn () => $b->reserve('qr', 2), 'esgotado');
        $this->refused(fn () => $b->reserve('qr', 2), 'esgotado');
        $this->assertSame(2, $this->used('qr'), 'recusa não altera o contador');
        $this->assertSame(2, $b->used('qr'));
    }

    public function test_tetos_zero_bloqueiam_e_nao_consomem(): void
    {
        $b = new DurableBudget($this->db);
        foreach (['customer_create', 'customer_list'] as $op) {
            $this->refused(fn () => $b->reserve($op, 0), 'esgotado');
            $this->assertSame(0, $this->used($op));
        }
    }

    public function test_ausente_e_diferente_de_zero(): void
    {
        $b = new DurableBudget($this->db);
        $this->assertSame(0, $b->used('qr'));
        $this->pdo->exec("DELETE FROM asaas_request_budget WHERE op = 'qr'");
        $this->assertNull($b->used('qr'));
    }

    public function test_linha_da_operacao_ausente_recusa_e_nao_recria(): void
    {
        $this->pdo->exec("DELETE FROM asaas_request_budget WHERE op = 'payment_get'");

        $this->refused(fn () => (new DurableBudget($this->db))->reserve('payment_get', 5), 'inconsistente');
        $this->assertNull($this->used('payment_get'), 'a ausência não pode recriar saldo');
    }

    public function test_sentinela_ausente_ou_janela_divergente_recusa_e_desfaz_a_reserva(): void
    {
        $b = new DurableBudget($this->db);
        $b->reserve('payment_get', 5);

        $this->pdo->exec("UPDATE asaas_request_budget SET window_id = 'outra-janela' WHERE op = 'payment_get'");
        $this->refused(fn () => $b->reserve('payment_get', 5), 'inconsistente');
        $this->assertSame(1, $this->used('payment_get'), 'a reserva da tentativa recusada foi desfeita');

        $this->pdo->exec("UPDATE asaas_request_budget SET window_id = (SELECT window_id FROM asaas_request_budget WHERE op = 'qr') WHERE op = 'payment_get'");
        $this->pdo->exec("DELETE FROM asaas_request_budget WHERE op = '_window'");
        $this->refused(fn () => $b->reserve('payment_get', 5), 'inconsistente');
        $this->assertSame(1, $this->used('payment_get'));
        $this->assertNull($this->used('_window'), 'a sentinela não é recriada');
    }

    public function test_tabela_inexistente_recusa(): void
    {
        $this->pdo->exec('DROP TABLE asaas_request_budget');

        $this->refused(fn () => (new DurableBudget($this->db))->reserve('qr', 5), 'indisponível');
        $this->assertNull((new DurableBudget($this->db))->used('qr'));
    }

    public function test_falha_de_gravacao_recusa_sem_consumir(): void
    {
        $this->pdo->exec("CREATE TRIGGER bloqueia BEFORE UPDATE ON asaas_request_budget BEGIN SELECT RAISE(ABORT, 'disco cheio'); END");

        $msg = $this->refused(fn () => (new DurableBudget($this->db))->reserve('payment_get', 5), 'indisponível');
        $this->assertStringNotContainsString('esgotado', $msg);
        $this->assertSame(0, $this->used('payment_get'));
    }

    public function test_dentro_de_transacao_externa_a_reserva_e_recusada(): void
    {
        $b = new DurableBudget($this->db);
        $this->db->beginTransaction();
        try {
            $this->refused(fn () => $b->reserve('payment_get', 5), 'transação externa');
            $this->assertSame(0, $this->used('payment_get'));

            // Só com o nível aceito pelo ambiente (testes com RefreshDatabase) a reserva prossegue.
            (new DurableBudget($this->db, 1))->reserve('payment_get', 5);
            $this->assertSame(1, $this->used('payment_get'));
        } finally {
            $this->db->rollBack();
        }
    }

    public function test_inicializar_de_novo_nao_altera_contadores_nem_janela(): void
    {
        $b = new DurableBudget($this->db);
        $b->reserve('payment_create', 3);
        $b->reserve('payment_create', 3);
        $window = $this->pdo->query("SELECT window_id FROM asaas_request_budget WHERE op = '_window'")->fetchColumn();

        $this->assertFalse(DurableBudget::initialize($this->db));

        $this->assertSame(2, $this->used('payment_create'));
        $this->assertSame($window, $this->pdo->query("SELECT window_id FROM asaas_request_budget WHERE op = '_window'")->fetchColumn());
        $this->assertSame(7, (int) $this->pdo->query('SELECT COUNT(*) FROM asaas_request_budget')->fetchColumn());
    }

    public function test_operacao_ou_teto_invalidos_sao_recusados(): void
    {
        $b = new DurableBudget($this->db);
        $this->refused(fn () => $b->reserve('operacao_desconhecida', 5), 'inválido');
        $this->refused(fn () => $b->reserve('_window', 5), 'inválido');
        $this->refused(fn () => $b->reserve('qr', -1), 'inválido');
    }
}

<?php

namespace Tests\Unit;

use App\Services\Payments\Asaas\DurableBudget;
use Illuminate\Database\SQLiteConnection;
use PHPUnit\Framework\TestCase;

/**
 * Concorrência REAL entre processos sobre o DurableBudget, em arquivo SQLite temporário (sem framework da aplicação,
 * .env, MySQL operacional nem rede), com o transaction_mode da aplicação (DEFERRED).
 *
 * NÃO prova atomicidade no MySQL: o SQLite serializa escritas no arquivo inteiro. Prova a LÓGICA (UPDATE condicional,
 * inicialização por chave primária, recusa com registro ausente) contra o código real. A prova no InnoDB exige o
 * ambiente descartável descrito em docs/ENTREGA-01-COBRANCA-PIX.md.
 */
class DurableBudgetRaceTest extends TestCase
{
    private string $file;

    private \PDO $pdo;

    protected function setUp(): void
    {
        if (! function_exists('proc_open') || ! in_array('sqlite', \PDO::getAvailableDrivers(), true)) {
            $this->markTestSkipped('proc_open ou pdo_sqlite indisponível.');
        }
        $this->file = sys_get_temp_dir().'/bnr-budget-'.bin2hex(random_bytes(4)).'.sqlite';
        $this->pdo = new \PDO('sqlite:'.$this->file, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $this->pdo->exec('CREATE TABLE asaas_request_budget (op varchar(32) NOT NULL PRIMARY KEY, used integer NOT NULL DEFAULT 0, window_id varchar(32) NOT NULL, created_at datetime NULL, updated_at datetime NULL)');
    }

    protected function tearDown(): void
    {
        @unlink($this->file);
    }

    /** @return array{granted:int,exhausted:int,errors:int,initialized:int,bad:int,first_error:?string} */
    private function run8(string $mode, int $limit, int $attempts): array
    {
        $start = microtime(true) + 1.5;
        $procs = [];
        for ($i = 0; $i < 8; $i++) {
            $cmd = [PHP_BINARY, __DIR__.'/../Support/budget_worker.php', $this->file, $mode, 'payment_get', (string) $limit, (string) $attempts, (string) $start];
            $procs[] = [proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes), $pipes];
        }
        $t = ['granted' => 0, 'exhausted' => 0, 'errors' => 0, 'initialized' => 0, 'bad' => 0, 'first_error' => null];
        foreach ($procs as [$p, $pipes]) {
            $out = stream_get_contents($pipes[1]);
            $err = stream_get_contents($pipes[2]);
            proc_close($p);
            $r = json_decode($out, true);
            if (! is_array($r)) {
                $t['bad']++;
                $t['first_error'] ??= substr($out.$err, 0, 200);

                continue;
            }
            $t['granted'] += $r['granted'] ?? 0;
            $t['exhausted'] += $r['exhausted'] ?? 0;
            $t['errors'] += $r['errors'] ?? 0;
            $t['initialized'] += ($r['initialized'] ?? false) ? 1 : 0;
            $t['first_error'] ??= $r['first_error'] ?? null;
        }

        return $t;
    }

    private function conn(): SQLiteConnection
    {
        return new SQLiteConnection($this->pdo, $this->file, '', ['transaction_mode' => 'DEFERRED']);
    }

    private function counter(string $op = 'payment_get'): ?int
    {
        $v = $this->pdo->query("SELECT used FROM asaas_request_budget WHERE op = '{$op}'")->fetchColumn();

        return $v === false ? null : (int) $v;
    }

    public function test_inicializacao_concorrente_acontece_uma_unica_vez(): void
    {
        $r = $this->run8('init', 0, 0);

        $this->assertSame(0, $r['bad'], (string) $r['first_error']);
        $this->assertSame(1, $r['initialized'], 'exatamente um processo deve inicializar');
        $this->assertSame(7, (int) $this->pdo->query('SELECT COUNT(*) FROM asaas_request_budget')->fetchColumn());
        $this->assertSame(1, (int) $this->pdo->query('SELECT COUNT(DISTINCT window_id) FROM asaas_request_budget')->fetchColumn());
        $this->assertSame(0, (int) $this->pdo->query('SELECT SUM(used) FROM asaas_request_budget')->fetchColumn());
    }

    public function test_primeira_reserva_concorrente_com_registro_ausente_nao_recria_saldo(): void
    {
        // Tabela vazia (nunca inicializada, ou linhas apagadas): ninguém pode reservar e nada é recriado.
        $r = $this->run8('reserve', 10, 6);

        $this->assertSame(0, $r['bad'], (string) $r['first_error']);
        $this->assertSame(0, $r['granted']);
        $this->assertSame(0, $r['exhausted']);
        $this->assertSame(48, $r['errors']);
        $this->assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM asaas_request_budget')->fetchColumn(), 'a ausência não pode recriar linhas');
    }

    public function test_teto_sob_concorrencia_e_saldo_preservado_apos_reinicio(): void
    {
        $this->assertTrue(DurableBudget::initialize($this->conn()));
        $window = $this->pdo->query("SELECT window_id FROM asaas_request_budget WHERE op = '_window'")->fetchColumn();

        $r = $this->run8('reserve', 10, 6); // 8 processos x 6 = 48 tentativas para teto 10
        $this->assertSame(0, $r['bad'], (string) $r['first_error']);
        $this->assertSame(0, $r['errors'], (string) $r['first_error']);
        $this->assertSame(10, $r['granted']);
        $this->assertSame(38, $r['exhausted']);
        $this->assertSame(10, $this->counter());

        // "Reinício": processos novos. O saldo persistente não renova.
        $r2 = $this->run8('reserve', 10, 6);
        $this->assertSame(0, $r2['granted']);
        $this->assertSame(48, $r2['exhausted']);
        $this->assertSame(10, $this->counter());

        // Reinicializar (concorrentemente) não zera nada nem troca a janela.
        $r3 = $this->run8('init', 0, 0);
        $this->assertSame(0, $r3['initialized']);
        $this->assertSame(10, $this->counter());
        $this->assertSame($window, $this->pdo->query("SELECT window_id FROM asaas_request_budget WHERE op = '_window'")->fetchColumn());
    }

    public function test_concorrencia_perto_do_teto_concede_exatamente_o_que_resta(): void
    {
        $this->assertTrue(DurableBudget::initialize($this->conn()));
        $this->pdo->exec("UPDATE asaas_request_budget SET used = 7 WHERE op = 'payment_get'");

        $r = $this->run8('reserve', 10, 3); // 24 tentativas, restam 3

        $this->assertSame(0, $r['bad'], (string) $r['first_error']);
        $this->assertSame(0, $r['errors'], (string) $r['first_error']);
        $this->assertSame(3, $r['granted']);
        $this->assertSame(21, $r['exhausted']);
        $this->assertSame(10, $this->counter());
    }
}

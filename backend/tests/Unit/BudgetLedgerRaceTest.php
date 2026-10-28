<?php

namespace Tests\Unit;

use App\Services\Payments\Asaas\BudgetLedger;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Cache\Repository;
use Illuminate\Database\SQLiteConnection;
use PHPUnit\Framework\TestCase;

/**
 * Concorrência REAL entre processos sobre o DatabaseStore do Laravel, em arquivo SQLite temporário (sem framework,
 * .env, MySQL operacional nem rede). Prova a lógica de inicialização/reserva contra o código real do DatabaseStore;
 * NÃO prova a semântica do MySQL (SQLite serializa escritas no arquivo todo e ignora lockForUpdate).
 */
class BudgetLedgerRaceTest extends TestCase
{
    public function test_oito_processos_disputando_o_primeiro_uso_nunca_ultrapassam_o_teto(): void
    {
        if (! function_exists('proc_open') || ! in_array('sqlite', \PDO::getAvailableDrivers(), true)) {
            $this->markTestSkipped('proc_open ou pdo_sqlite indisponível.');
        }
        $file = sys_get_temp_dir().'/bnr-ledger-'.bin2hex(random_bytes(4)).'.sqlite';
        $pdo = new \PDO('sqlite:'.$file, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $pdo->exec('CREATE TABLE cache ("key" varchar PRIMARY KEY, value text NOT NULL, expiration integer NOT NULL)');

        $limit = 10;
        $start = microtime(true) + 1.5;
        $procs = [];
        for ($i = 0; $i < 8; $i++) {
            $cmd = [PHP_BINARY, __DIR__.'/../Support/budget_worker.php', $file, 'payment_get', (string) $limit, '6', (string) $start];
            $p = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            $procs[] = [$p, $pipes];
        }
        $granted = $exhausted = $errors = 0;
        foreach ($procs as [$p, $pipes]) {
            $out = stream_get_contents($pipes[1]);
            $err = stream_get_contents($pipes[2]);
            proc_close($p);
            $r = json_decode($out, true);
            $this->assertIsArray($r, "saída inesperada do worker: {$out} {$err}");
            $granted += $r['granted'];
            $exhausted += $r['exhausted'];
            $errors += $r['errors'];
        }

        $stored = $pdo->query("SELECT value FROM cache WHERE \"key\" = 'asaas:ledger:payment_get'")->fetchColumn();
        @unlink($file);

        $this->assertLessThanOrEqual($limit, $granted, 'o teto foi ultrapassado');
        $this->assertSame(48, $granted + $exhausted + $errors);
        $this->assertSame(0, $errors, 'erros de cache (SQLite) impediram a medição completa; falhar fechado é seguro, mas o teste não conclui');
        $this->assertSame($limit, $granted);
        $this->assertSame($limit, (int) unserialize($stored), 'o contador não corresponde às reservas concedidas');
    }
}

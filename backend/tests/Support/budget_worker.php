<?php

/**
 * Processo de apoio dos testes de concorrência do DurableBudget. NÃO usa o framework da aplicação, .env, MySQL operacional
 * nem rede: só as classes do orçamento sobre um arquivo SQLite temporário, com o mesmo transaction_mode da aplicação (DEFERRED).
 *
 * Uso: php budget_worker.php <arquivo> <modo init|reserve> <op> <teto> <tentativas> <inicio_epoch_float>
 * Saída (JSON): init => {initialized: bool}; reserve => {granted, exhausted, errors, first_error}.
 */

use App\Services\Payments\Asaas\AsaasRefusedException;
use App\Services\Payments\Asaas\DurableBudget;
use Illuminate\Database\SQLiteConnection;

require __DIR__.'/../../vendor/autoload.php';

[, $file, $mode, $op, $limit, $attempts, $start] = $argv;
$pdo = new PDO('sqlite:'.$file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 30]);
$connection = new SQLiteConnection($pdo, $file, '', ['transaction_mode' => 'DEFERRED']);
$budget = new DurableBudget($connection);

while (microtime(true) < (float) $start) {
    usleep(200);
}

if ($mode === 'init') {
    echo json_encode(['initialized' => DurableBudget::initialize($connection)]);
    exit(0);
}

$out = ['granted' => 0, 'exhausted' => 0, 'errors' => 0, 'first_error' => null];
for ($i = 0; $i < (int) $attempts; $i++) {
    try {
        $budget->reserve($op, (int) $limit);
        $out['granted']++;
    } catch (AsaasRefusedException $e) {
        if (str_contains($e->getMessage(), 'esgotado')) {
            $out['exhausted']++;
        } else {
            $out['errors']++;
            $out['first_error'] ??= $e->getMessage();
        }
    }
}
echo json_encode($out);

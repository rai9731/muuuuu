<?php

/**
 * Processo de apoio do teste de concorrência do BudgetLedger. NÃO usa o framework, .env, MySQL nem rede: só o
 * DatabaseStore do Laravel sobre um arquivo SQLite temporário. Uso: php budget_worker.php <arquivo> <op> <teto> <tentativas> <inicio_epoch_float>
 * Saída (JSON): granted | exhausted | errors.
 */

use App\Services\Payments\Asaas\AsaasRefusedException;
use App\Services\Payments\Asaas\BudgetLedger;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Cache\Repository;
use Illuminate\Database\SQLiteConnection;

require __DIR__.'/../../vendor/autoload.php';

[, $file, $op, $limit, $attempts, $start] = $argv;
$pdo = new PDO('sqlite:'.$file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 30]);
$connection = new SQLiteConnection($pdo, $file, '', ['transaction_mode' => 'IMMEDIATE']);
$ledger = new BudgetLedger(new Repository(new DatabaseStore($connection, 'cache')));

while (microtime(true) < (float) $start) {
    usleep(200);
}
$out = ['granted' => 0, 'exhausted' => 0, 'errors' => 0];
for ($i = 0; $i < (int) $attempts; $i++) {
    try {
        $ledger->reserve($op, (int) $limit);
        $out['granted']++;
    } catch (AsaasRefusedException $e) {
        str_contains($e->getMessage(), 'esgotado') ? $out['exhausted']++ : $out['errors']++;
    }
}
echo json_encode($out);

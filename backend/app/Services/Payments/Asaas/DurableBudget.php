<?php

namespace App\Services\Payments\Asaas;

use Illuminate\Database\Connection;

/**
 * Orçamento de requisições ao Asaas guardado NO BANCO (tabela `asaas_request_budget`), fora do cache.
 *
 * Uma linha por operação mais uma linha-sentinela (`_window`) que identifica a janela: todas as linhas carregam o mesmo
 * `window_id`, gerado uma única vez em {@see initialize()} (chamada pela migração). Regras:
 *  - A reserva é UM `UPDATE ... SET used = used + 1 WHERE op = ? AND used < teto`, atômico por linha (InnoDB: trava de
 *    linha; SQLite: trava de escrita). Não há leitura-depois-escrita nem dependência de `lockForUpdate` sobre linha ausente.
 *  - Depois do UPDATE, ainda na mesma transação, confere linha, sentinela e `window_id`. Qualquer ausência ou divergência
 *    desfaz a transação (a reserva some) e a requisição é recusada. Linha ausente NUNCA recria saldo.
 *  - A transação é confirmada ANTES de `reserve()` retornar; só então o chamador envia. Dentro de uma transação externa
 *    a reserva não estaria confirmada, então é recusada (falha fechado).
 *  - A reserva nunca é devolvida: recusa por teto não altera o contador, e timeout/queda/incerteza não o decrementam.
 *  - Falha de leitura/gravação, tabela inexistente ou dado corrompido => recusa (nada é enviado).
 *
 * Limites: protege contra `cache:clear`, `optimize:clear` e reinício, desde que o banco seja preservado. NÃO protege contra
 * restauração de backup, apagamento/recriação da tabela (`migrate:fresh`, `db:wipe`, `DROP`) nem perda do banco.
 */
final class DurableBudget
{
    public const TABLE = 'asaas_request_budget';

    public const SENTINEL = '_window';

    /** @param int $allowedTransactionLevel nível de transação já aberto pelo ambiente (testes com RefreshDatabase); em produção, 0 */
    public function __construct(private readonly Connection $db, private readonly int $allowedTransactionLevel = 0) {}

    /**
     * Inicializa o orçamento UMA vez: sentinela + uma linha por operação, em uma transação, com INSERT IGNORE
     * (chave primária `op`). Chamadas seguintes ou concorrentes não alteram nada. Devolve true só para quem inicializou.
     */
    public static function initialize(Connection $db): bool
    {
        return $db->transaction(function () use ($db) {
            $now = date('Y-m-d H:i:s');
            $window = bin2hex(random_bytes(16));
            $row = fn (string $op) => ['op' => $op, 'used' => 0, 'window_id' => $window, 'created_at' => $now, 'updated_at' => $now];

            if ($db->table(self::TABLE)->insertOrIgnore($row(self::SENTINEL)) !== 1) {
                return false; // já inicializado (ou outro processo está terminando a transação dele)
            }
            foreach (AsaasConfig::OPERATIONS as $op) {
                if ($db->table(self::TABLE)->insertOrIgnore($row($op)) !== 1) {
                    throw new \RuntimeException('Orçamento inconsistente na inicialização.');
                }
            }

            return true;
        });
    }

    /**
     * Reserva uma unidade e a confirma no banco antes de retornar.
     *
     * @throws AsaasRefusedException nada deve ser enviado (esgotado, inconsistente, indisponível ou transação externa)
     */
    public function reserve(string $op, int $limit): void
    {
        if (! in_array($op, AsaasConfig::OPERATIONS, true) || $limit < 0) {
            throw new AsaasRefusedException('Operação ou teto inválido; nada foi enviado.');
        }
        if ($this->db->transactionLevel() > $this->allowedTransactionLevel) {
            throw new AsaasRefusedException('Reserva de orçamento dentro de transação externa não é confirmável; nada foi enviado.');
        }

        try {
            $granted = $this->db->transaction(function () use ($op, $limit) {
                $n = $this->db->table(self::TABLE)->where('op', $op)->where('used', '<', $limit)
                    ->increment('used', 1, ['updated_at' => date('Y-m-d H:i:s')]);

                $row = $this->db->table(self::TABLE)->where('op', $op)->first();
                $window = $this->db->table(self::TABLE)->where('op', self::SENTINEL)->first();
                if (! $row || ! $window || ! is_string($row->window_id) || $row->window_id === '' || $row->window_id !== $window->window_id
                    || ! is_numeric($row->used) || (int) $row->used < 0) {
                    throw new \RuntimeException('Registro do orçamento ausente ou inconsistente.');
                }

                return $n === 1;
            });
        } catch (\Throwable $e) {
            throw new AsaasRefusedException('Orçamento de requisições indisponível ou inconsistente; nada foi enviado.', 0, $e);
        }

        if (! $granted) {
            throw new AsaasRefusedException("Orçamento de requisições '{$op}' esgotado.");
        }
    }

    /** Reservas já feitas. null = linha ausente ou ilegível (diferente de 0). Só para relatório; nunca autoriza nada. */
    public function used(string $op): ?int
    {
        try {
            $row = $this->db->table(self::TABLE)->where('op', $op)->first();
        } catch (\Throwable) {
            return null;
        }

        return $row && is_numeric($row->used) ? (int) $row->used : null;
    }
}

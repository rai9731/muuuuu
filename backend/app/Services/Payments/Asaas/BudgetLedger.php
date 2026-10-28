<?php

namespace App\Services\Payments\Asaas;

use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Orçamento de requisições e trava de "uma criação por recurso".
 *
 * ORÇAMENTO: persistente no banco ({@see DurableBudget}), não no cache. `cache:clear`, `optimize:clear` e reinício não o
 * renovam. A reserva é confirmada antes do envio e nunca é devolvida.
 *
 * TRAVA DE CRIAÇÃO (`claimOnce`): continua no cache, com `add()` COM TTL (database: INSERT IGNORE; redis: SET NX;
 * memcached: add), que nunca sobrescreve. É defesa redundante e NÃO durável: a proteção contra segunda criação é o
 * status persistido em `payments`/`settings`.
 */
final class BudgetLedger
{
    /** Mesmo valor do `forever()` do driver database (10 anos), usado só na trava de criação. */
    public const TTL = 315360000;

    public function __construct(private readonly Repository $cache, private readonly DurableBudget $budget) {}

    /** Instância da aplicação: orçamento na conexão padrão do banco e trava no cache padrão. */
    public static function forApplication(): self
    {
        $db = DB::connection();
        // Testes com RefreshDatabase já rodam dentro de uma transação; em produção o nível aceito é 0.
        $level = app()->environment('testing') ? $db->transactionLevel() : 0;

        return new self(Cache::store(), new DurableBudget($db, $level));
    }

    /** @return int|null reservas feitas; null = linha ausente/ilegível (não confundir com 0) */
    public function used(string $op): ?int
    {
        return $this->budget->used($op);
    }

    /**
     * Reserva uma unidade, confirmada no banco antes de retornar. Falha fechado.
     *
     * @throws AsaasRefusedException
     */
    public function reserve(string $op, int $limit): void
    {
        $this->budget->reserve($op, $limit);
    }

    /**
     * Trava de criação: true só para a primeira chamada de cada $name (add com TTL, sem sobrescrita).
     *
     * @throws AsaasRefusedException cache indisponível (nada foi enviado)
     */
    public function claimOnce(string $name): bool
    {
        try {
            return (bool) $this->cache->add('asaas:create-attempt:'.$name, date('c'), self::TTL);
        } catch (\Throwable) {
            throw new AsaasRefusedException('Controle de criação indisponível; nada foi enviado.');
        }
    }

    public function release(string $name): void
    {
        try {
            $this->cache->forget('asaas:create-attempt:'.$name);
        } catch (\Throwable) {
        }
    }
}

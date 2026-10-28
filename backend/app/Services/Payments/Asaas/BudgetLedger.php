<?php

namespace App\Services\Payments\Asaas;

use Illuminate\Contracts\Cache\Repository;

/**
 * Contador de orçamento de requisições e trava de "uma criação por recurso", sobre um repositório de cache.
 *
 * Inicialização SEM sobrescrita: `Repository::add()` sem TTL cai em get + put (não atômico) e pode recolocar o contador
 * em zero depois de um incremento concorrente. Aqui a criação usa `add()` COM TTL, que delega ao `add` do driver
 * (database: INSERT IGNORE; redis: SET NX; memcached: add) e nunca sobrescreve. Quem perde a corrida incrementa.
 *
 * Atomicidade do incremento entre processos é do driver (database: transação com lockForUpdate; redis: INCR).
 * O contador é cache: expira em TTL e `cache:clear`/perda do cache o reinicia (reabre o orçamento).
 */
final class BudgetLedger
{
    /** Mesmo valor do `forever()` do driver database (10 anos). */
    public const TTL = 315360000;

    public function __construct(private readonly Repository $cache) {}

    public function used(string $op): int
    {
        return (int) $this->cache->get($this->key($op), 0);
    }

    /**
     * Reserva uma unidade. Falha fechado: exceção ou retorno inesperado do cache => AsaasRefusedException (nada enviado).
     *
     * @throws AsaasRefusedException
     */
    public function reserve(string $op, int $limit): void
    {
        $key = $this->key($op);
        try {
            $used = $this->cache->increment($key);
            if ($used === false) { // contador ainda não existe
                $used = $this->cache->add($key, 1, self::TTL) ? 1 : $this->cache->increment($key);
            }
        } catch (\Throwable) {
            throw new AsaasRefusedException('Contador de orçamento indisponível; nada foi enviado.');
        }
        if (! is_int($used) || $used < 1) {
            throw new AsaasRefusedException('Contador de orçamento inválido; nada foi enviado.');
        }
        if ($used > $limit) {
            try {
                $this->cache->decrement($key);
            } catch (\Throwable) {
                // o contador fica alto: erra para o lado seguro
            }
            throw new AsaasRefusedException("Orçamento de requisições '{$op}' esgotado.");
        }
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

    private function key(string $op): string
    {
        return "asaas:ledger:{$op}";
    }
}

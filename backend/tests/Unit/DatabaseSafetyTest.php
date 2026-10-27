<?php

namespace Tests\Unit;

use Tests\TestCase;

/** Não consulta o banco: só confirma o isolamento (a trava em TestCase::createApplication roda antes). */
class DatabaseSafetyTest extends TestCase
{
    public function test_testes_usam_sqlite_em_memoria_e_cache_array(): void
    {
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame('array', config('cache.default'));
    }
}

<?php

use App\Services\Payments\Asaas\DurableBudget;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Orçamento de requisições do Asaas Sandbox, fora do cache. A inicialização (sentinela + 6 operações, used = 0) acontece
 * aqui, uma única vez; depois dela a ausência de linha é falha (fechada), nunca motivo para recriar saldo.
 * Rodar `migrate:fresh`/`migrate:reset`/`db:wipe` ou `down()` recria/zera o orçamento: proibido durante uma janela.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create(DurableBudget::TABLE, function (Blueprint $table) {
            $table->string('op', 32)->primary();
            $table->unsignedInteger('used')->default(0);
            $table->string('window_id', 32);
            $table->timestamps();
        });

        DurableBudget::initialize(DB::connection());
    }

    public function down(): void
    {
        Schema::dropIfExists(DurableBudget::TABLE);
    }
};

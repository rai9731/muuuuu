<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Referência enviada ao gateway (código do pedido): permite localizar a cobrança se a resposta da criação se perder.
            $table->string('external_reference', 40)->nullable()->index()->after('gateway_id');
            // Último status informado pelo gateway e resultado da última conferência manual.
            $table->string('gateway_status', 30)->nullable()->after('status');
            $table->string('last_check_result', 20)->nullable();
            $table->timestamp('last_checked_at')->nullable();
            // Origem da confirmação: 'simulation' (gateway simulado) ou 'asaas_sandbox'.
            $table->string('confirmation_source', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['external_reference', 'gateway_status', 'last_check_result', 'last_checked_at', 'confirmation_source']);
        });
    }
};

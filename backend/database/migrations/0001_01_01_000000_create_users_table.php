<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password')->nullable();
            $table->string('google_id')->nullable()->unique();
            $table->string('avatar_path')->nullable();
            $table->string('role', 20)->default('user')->index();
            $table->string('status', 20)->default('active')->index();

            // LGPD: documento criptografado + hash (HMAC) para checar unicidade sem expor o valor
            $table->text('document')->nullable();
            $table->string('document_hash', 64)->nullable()->unique();
            $table->string('phone', 20)->nullable();
            $table->string('city', 120)->nullable();
            $table->char('state', 2)->nullable();
            $table->string('farm_name', 150)->nullable();
            $table->text('farm_description')->nullable();

            // Dados de recebimento (criptografados)
            $table->string('payout_pix_key_type', 20)->nullable();
            $table->text('payout_pix_key')->nullable();
            $table->text('payout_bank')->nullable();

            $table->string('asaas_customer_id')->nullable();
            $table->json('notification_preferences')->nullable();
            $table->boolean('must_change_password')->default(false);
            $table->timestamp('terms_accepted_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};

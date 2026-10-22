<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->foreignId('buyer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('seller_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('cow_id')->constrained()->onDelete('cascade');
            $table->decimal('price', 12, 2);
            $table->decimal('commission_percent', 5, 2);
            $table->decimal('platform_fee', 12, 2);
            $table->decimal('total', 12, 2);
            $table->decimal('seller_amount', 12, 2);
            $table->string('delivery_method', 20);
            $table->string('status', 30)->default('awaiting_payment')->index();
            $table->string('payout_status', 20)->default('not_applicable')->index();
            $table->string('payout_reference')->nullable();
            $table->timestamp('payout_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->onDelete('cascade');
            $table->foreignId('payer_id')->constrained('users')->onDelete('cascade');
            $table->string('gateway', 20)->default('asaas');
            $table->string('gateway_id')->nullable()->index();
            $table->string('method', 20);
            $table->string('status', 20)->default('pending')->index();
            $table->decimal('amount', 12, 2);
            $table->date('due_date')->nullable();
            $table->text('pix_payload')->nullable();
            $table->longText('pix_qr_image')->nullable();
            $table->string('boleto_url', 500)->nullable();
            $table->string('invoice_url', 500)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->onDelete('cascade');
            $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('seller_id')->constrained('users')->onDelete('cascade');
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('orders');
    }
};

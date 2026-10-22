<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('breeds', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80)->unique();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('cows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('breed_id')->constrained()->onDelete('cascade');
            $table->string('title', 120);
            $table->string('sex', 10)->default('femea');
            $table->unsignedSmallInteger('age_months');
            $table->decimal('weight_kg', 7, 2);
            $table->string('purpose', 20)->index();
            $table->decimal('milk_production_liters', 6, 2)->nullable();
            $table->text('description')->nullable();
            $table->boolean('vaccinated')->default(false);
            $table->json('vaccinations')->nullable();
            $table->boolean('is_pregnant')->default(false);
            $table->unsignedTinyInteger('pregnancy_months')->nullable();
            $table->text('health_history')->nullable();
            $table->decimal('price', 12, 2)->index();
            $table->string('city', 120);
            $table->char('state', 2)->index();
            $table->string('status', 20)->default('pending')->index();
            $table->string('rejection_reason', 500)->nullable();
            $table->boolean('verified')->default(false);
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('cow_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cow_id')->constrained()->onDelete('cascade');
            $table->string('type', 20); // photo | video | certificate
            $table->string('path');
            $table->string('thumb_path')->nullable();
            $table->string('original_name')->nullable();
            $table->string('mime', 100)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('cow_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['user_id', 'cow_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('cow_media');
        Schema::dropIfExists('cows');
        Schema::dropIfExists('breeds');
    }
};

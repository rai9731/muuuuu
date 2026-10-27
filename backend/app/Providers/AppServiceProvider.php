<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(\App\Services\Payments\PixGateway::class, fn () => match (config('boinarede.payment_gateway')) {
            'simulated' => new \App\Services\Payments\SimulatedPixGateway(),
            default => throw new \RuntimeException('Gateway de pagamento não suportado: '.config('boinarede.payment_gateway')),
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}

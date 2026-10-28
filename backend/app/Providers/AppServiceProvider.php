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
            // Falha fechado: configuração incompleta ou ambígua lança AsaasConfigurationException (nenhuma requisição possível).
            'asaas_sandbox' => (function () {
                $config = \App\Services\Payments\Asaas\AsaasConfig::fromConfig();

                return new \App\Services\Payments\Asaas\AsaasPixGateway($config, new \App\Services\Payments\Asaas\AsaasHttp($config));
            })(),
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

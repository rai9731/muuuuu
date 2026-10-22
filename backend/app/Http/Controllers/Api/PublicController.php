<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Breed;
use App\Models\Cow;
use App\Models\Order;
use App\Models\User;
use App\Support\Presenter;

class PublicController extends Controller
{
    public function config()
    {
        $demo = config('boinarede.demo');

        return ['data' => [
            'app_name' => 'Boi na Rede',
            'demo_login_enabled' => $demo['enabled'],
            'demo_accounts' => $demo['enabled'] ? [
                ['role' => 'seller', 'label' => 'Vendedor', 'email' => $demo['seller_email'], 'password' => $demo['password']],
                ['role' => 'buyer', 'label' => 'Comprador', 'email' => $demo['buyer_email'], 'password' => $demo['password']],
            ] : [],
            'google_enabled' => false,
            'payment_methods' => \App\Models\Setting::read('payment_methods', ['pix', 'credit_card', 'boleto']),
            'commission_percent' => \App\Models\Setting::commission(),
            'upload_max_size_mb' => config('boinarede.uploads.max_size_mb'),
            'upload_allowed_types' => config('boinarede.uploads.allowed_types'),
        ]];
    }

    public function breeds()
    {
        return ['data' => Breed::where('active', true)->orderBy('name')->get(['id', 'name'])];
    }

    public function landing()
    {
        $featured = Cow::with(['breed', 'media', 'seller'])->where('status', 'active')->latest('published_at')->limit(6)->get();

        return ['data' => [
            'texts' => \App\Models\Setting::read('landing', []) + [
                'hero_title' => 'Compre e venda gado direto com o produtor',
                'hero_subtitle' => 'Anúncios com fotos, documentação e pagamento seguro.',
                'cta_title' => 'Pronto para negociar?', 'cta_subtitle' => 'Crie sua conta e anuncie em minutos.',
                'contact_email' => '', 'contact_phone' => '', 'contact_address' => '',
                'instagram' => '', 'facebook' => '', 'youtube' => '',
            ],
            'testimonials' => \App\Models\Setting::read('testimonials', []),
            'stats' => [
                'cows' => Cow::where('status', 'active')->count(),
                'sales' => Order::where('status', 'delivered')->count(),
                'users' => User::count(),
            ],
            'featured' => $featured->map(fn ($c) => Presenter::cow($c))->all(),
        ]];
    }
}

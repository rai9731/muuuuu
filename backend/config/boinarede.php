<?php

// Configurações específicas do Boi na Rede (valores vêm do .env da raiz do projeto).
return [

    'frontend_url' => rtrim(env('FRONTEND_URL', env('APP_URL', 'http://localhost:8080')), '/'),

    'currency' => env('APP_CURRENCY', 'BRL'),

    // Tokens do Sanctum: sessão normal x "Lembrar de mim"
    'session_lifetime_minutes' => (int) env('SESSION_LIFETIME_MINUTES', 120),
    'remember_me_days' => (int) env('REMEMBER_ME_DAYS', 30),

    'demo' => [
        'enabled' => filter_var(env('DEMO_LOGIN_ENABLED', false), FILTER_VALIDATE_BOOL),
        'password' => env('DEMO_PASSWORD', '123456'),
        'admin_email' => env('DEMO_ADMIN_EMAIL', 'admin@admin.com'),
        'seller_email' => env('DEMO_SELLER_EMAIL', 'vendedor@boinarede.com.br'),
        'buyer_email' => env('DEMO_BUYER_EMAIL', 'comprador@boinarede.com.br'),
    ],

    'uploads' => [
        'max_size_mb' => (int) env('UPLOAD_MAX_SIZE_MB', 20),
        'allowed_types' => array_map('trim', explode(',', env('UPLOAD_ALLOWED_TYPES', 'jpg,jpeg,png,webp,mp4,pdf'))),
        'thumb_width' => 640,
    ],

    // Valor padrão; o administrador altera em Configurações (tabela settings)
    'commission_percent' => (float) env('PLATFORM_COMMISSION_PERCENT', 5),

    // Dias para vencimento de Pix/boleto; depois disso o pedido é cancelado e a vaca volta à vitrine (RN04)
    'payment_due_days' => 3,

    // Gateway de Pix. Padrão 'simulated' (nada externo). Ainda não existe adaptador do Asaas.
    'payment_gateway' => env('PAYMENT_GATEWAY', 'simulated'),

    'mail_enabled' => filter_var(env('MAIL_ENABLED', false), FILTER_VALIDATE_BOOL),
    'push_enabled' => filter_var(env('PUSH_NOTIFICATIONS_ENABLED', false), FILTER_VALIDATE_BOOL),
];

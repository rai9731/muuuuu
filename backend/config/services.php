<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'asaas' => [
        'env' => env('ASAAS_ENV', 'sandbox'),
        'url' => env('ASAAS_API_URL', 'https://sandbox.asaas.com/api/v3'),
        'key' => env('ASAAS_API_KEY'),
        'webhook_token' => env('ASAAS_WEBHOOK_TOKEN'),
        // Só o adaptador do SANDBOX usa estes valores, e só com PAYMENT_GATEWAY=asaas_sandbox. Nada disso tem padrão ativo.
        'sandbox_authorized' => env('ASAAS_SANDBOX_AUTHORIZED', false),
        'timeout' => env('ASAAS_TIMEOUT', 10),
        'test_customer' => [
            'id' => env('ASAAS_TEST_CUSTOMER_ID'),
            'name' => env('ASAAS_TEST_CUSTOMER_NAME'),
            'document' => env('ASAAS_TEST_CUSTOMER_DOCUMENT'),
        ],
        // Orçamento de requisições HTTP por operação (inteiro; ausente ou 0 = bloqueado).
        'budget' => [
            'customer_create' => env('ASAAS_BUDGET_CUSTOMER_CREATE'),
            'customer_list' => env('ASAAS_BUDGET_CUSTOMER_LIST'),
            'payment_create' => env('ASAAS_BUDGET_PAYMENT_CREATE'),
            'qr' => env('ASAAS_BUDGET_QR'),
            'payment_get' => env('ASAAS_BUDGET_PAYMENT_GET'),
            'payment_list' => env('ASAAS_BUDGET_PAYMENT_LIST'),
        ],
    ],

];

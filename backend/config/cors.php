<?php

// O frontend é servido pela mesma origem (Nginx), então só ela é liberada.
return [
    'paths' => ['api/*', 'auth/google/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_filter([rtrim(env('FRONTEND_URL', env('APP_URL', '')), '/')]),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With'],
    'exposed_headers' => ['Content-Disposition'],
    'max_age' => 3600,
    'supports_credentials' => false,
];

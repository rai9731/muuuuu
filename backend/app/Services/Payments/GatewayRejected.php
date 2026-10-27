<?php

namespace App\Services\Payments;

/** Recusa definitiva: sabemos que nenhuma cobrança foi criada. */
class GatewayRejected extends \RuntimeException {}

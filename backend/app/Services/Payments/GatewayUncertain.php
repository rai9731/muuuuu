<?php

namespace App\Services\Payments;

/** Resultado incerto (timeout, rede, resposta inválida): nunca repetir a criação automaticamente. */
class GatewayUncertain extends \RuntimeException {}

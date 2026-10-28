<?php

namespace App\Services\Payments\Asaas;

/** Falha de transporte, redirecionamento, 408/5xx ou resposta ilegível: o servidor pode ter processado a requisição. */
class AsaasTransportException extends \RuntimeException {}

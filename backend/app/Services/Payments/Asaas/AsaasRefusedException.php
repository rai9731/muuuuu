<?php

namespace App\Services\Payments\Asaas;

/** Recusa definitiva: orçamento esgotado ou resposta 4xx (a requisição não surtiu efeito). Nenhum corpo é propagado. */
class AsaasRefusedException extends \RuntimeException {}

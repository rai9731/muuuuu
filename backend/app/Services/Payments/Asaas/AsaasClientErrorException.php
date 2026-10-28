<?php

namespace App\Services\Payments\Asaas;

/**
 * Resposta 4xx recebida DEPOIS do envio. O contrato do Asaas não foi verificado, então um 4xx não prova que nada foi
 * criado: é tratado como resultado incerto (nunca reabre criação). Nenhum corpo é guardado.
 */
class AsaasClientErrorException extends AsaasTransportException {}

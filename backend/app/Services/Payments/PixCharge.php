<?php

namespace App\Services\Payments;

/** Cobrança Pix como informada pelo gateway (nunca confiar em valores vindos do navegador). */
final class PixCharge
{
    public function __construct(
        public readonly string $id,
        public readonly string $reference,
        public readonly float $value,
        public readonly string $status,
        public readonly ?string $pixPayload = null,
        public readonly ?string $pixQrImage = null,
    ) {}
}

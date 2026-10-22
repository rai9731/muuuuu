<?php

namespace App\Models\Concerns;

use DateTimeInterface;

/** Datas sempre serializadas em UTC-3 (America/Sao_Paulo), com o offset explícito. */
trait SerializesLocalDates
{
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->setTimezone(new \DateTimeZone(config('app.timezone')))->format('Y-m-d\TH:i:sP');
    }
}

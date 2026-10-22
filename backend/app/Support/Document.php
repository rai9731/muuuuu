<?php

namespace App\Support;

/** Validação e formatação de CPF/CNPJ. */
class Document
{
    public static function digits(?string $value): string
    {
        return preg_replace('/\D/', '', (string) $value);
    }

    public static function isValid(?string $value): bool
    {
        $digits = self::digits($value);

        return match (strlen($digits)) {
            11 => self::isValidCpf($digits),
            14 => self::isValidCnpj($digits),
            default => false,
        };
    }

    public static function isValidCpf(string $cpf): bool
    {
        if (preg_match('/^(\d)\1{10}$/', $cpf)) {
            return false;
        }
        for ($t = 9; $t < 11; $t++) {
            $sum = 0;
            for ($i = 0; $i < $t; $i++) {
                $sum += (int) $cpf[$i] * (($t + 1) - $i);
            }
            $digit = ((10 * $sum) % 11) % 10;
            if ((int) $cpf[$t] !== $digit) {
                return false;
            }
        }

        return true;
    }

    public static function isValidCnpj(string $cnpj): bool
    {
        if (preg_match('/^(\d)\1{13}$/', $cnpj)) {
            return false;
        }
        $calc = function (int $length) use ($cnpj): int {
            $weights = $length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
            $sum = 0;
            foreach ($weights as $i => $w) {
                $sum += (int) $cnpj[$i] * $w;
            }
            $rest = $sum % 11;

            return $rest < 2 ? 0 : 11 - $rest;
        };

        return $calc(12) === (int) $cnpj[12] && $calc(13) === (int) $cnpj[13];
    }

    /** Hash determinístico (HMAC com a APP_KEY) para checar unicidade sem guardar o documento em claro. */
    public static function hash(?string $value): ?string
    {
        $digits = self::digits($value);

        return $digits === '' ? null : hash_hmac('sha256', $digits, (string) config('app.key'));
    }

    public static function format(?string $value): ?string
    {
        $d = self::digits($value);
        if (strlen($d) === 11) {
            return substr($d, 0, 3).'.'.substr($d, 3, 3).'.'.substr($d, 6, 3).'-'.substr($d, 9, 2);
        }
        if (strlen($d) === 14) {
            return substr($d, 0, 2).'.'.substr($d, 2, 3).'.'.substr($d, 5, 3).'/'.substr($d, 8, 4).'-'.substr($d, 12, 2);
        }

        return $value;
    }
}

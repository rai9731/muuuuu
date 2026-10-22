<?php

namespace App\Rules;

use App\Support\Document;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ValidDocument implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! Document::isValid((string) $value)) {
            $fail('Informe um CPF ou CNPJ válido.');
        }
    }
}

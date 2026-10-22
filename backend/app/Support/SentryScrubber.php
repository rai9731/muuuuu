<?php

namespace App\Support;

use Sentry\Event;

/** LGPD: garante que dados pessoais e de pagamento não sejam enviados ao Sentry. */
class SentryScrubber
{
    private const SENSITIVE = '/pass(word)?|senha|token|secret|authorization|cookie|document|cpf|cnpj|card|cartao|cvv|pix|bank|account|agency|phone|telefone|email/i';

    public static function beforeSend(Event $event): ?Event
    {
        $request = $event->getRequest();
        if (! empty($request)) {
            unset($request['cookies']);
            if (isset($request['headers'])) {
                $request['headers'] = self::scrub($request['headers']);
            }
            if (isset($request['data'])) {
                $request['data'] = self::scrub($request['data']);
            }
            $event->setRequest($request);
        }

        $user = $event->getUser();
        if ($user !== null) {
            $user->setEmail(null);
            $user->setIpAddress(null);
            $user->setUsername(null);
        }

        $event->setExtra(self::scrub($event->getExtra()));

        return $event;
    }

    private static function scrub(mixed $data): mixed
    {
        if (! is_array($data)) {
            return $data;
        }
        foreach ($data as $key => $value) {
            $data[$key] = is_string($key) && preg_match(self::SENSITIVE, $key) ? '[removido]' : self::scrub($value);
        }

        return $data;
    }
}

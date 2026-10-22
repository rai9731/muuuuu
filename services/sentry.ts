import * as Sentry from '@sentry/react';

const SENSITIVE_KEYS = /pass(word)?|senha|token|secret|authorization|cpf|cnpj|document|card|cartao|cvv|pix|account|agency|phone|telefone/i;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE_KEYS.test(k) ? '[removido]' : scrub(v)]),
    );
  }
  return value;
}

/** Inicializa o Sentry no frontend sem enviar dados pessoais (LGPD). */
export function initSentry() {
  if (!__SENTRY_DSN__) return;
  Sentry.init({
    dsn: __SENTRY_DSN__,
    environment: __SENTRY_ENVIRONMENT__,
    tracesSampleRate: __SENTRY_TRACES_SAMPLE_RATE__,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        if (event.request.data) event.request.data = scrub(event.request.data);
      }
      if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.data) crumb.data = scrub(crumb.data) as Record<string, unknown>;
      return crumb;
    },
  });
}

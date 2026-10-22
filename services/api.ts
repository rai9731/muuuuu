// Cliente HTTP único da aplicação. Componentes nunca chamam fetch diretamente.
import * as Sentry from '@sentry/react';

const TOKEN_KEY = 'bnr_token';

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }

  /** Primeira mensagem de validação de um campo. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

const FRIENDLY_MESSAGES: Record<number, string> = {
  0: 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',
  401: 'Sua sessão expirou. Entre novamente para continuar.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'Não encontramos o que você procurava.',
  413: 'O arquivo enviado é maior que o permitido.',
  419: 'Sua sessão expirou. Recarregue a página.',
  422: 'Alguns campos precisam de atenção.',
  429: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.',
  500: 'Algo deu errado do nosso lado. Já fomos avisados e estamos verificando.',
  502: 'O servidor está temporariamente indisponível. Tente novamente em instantes.',
  503: 'Estamos em manutenção rápida. Tente novamente em alguns segundos.',
};

export const tokenStorage = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string, remember: boolean) => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
      /* armazenamento indisponível (modo privado) */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let unauthorizedHandler: (() => void) | null = null;
export const onUnauthorized = (handler: () => void) => {
  unauthorizedHandler = handler;
};

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  raw?: boolean;
}

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}${buildQuery(options.query)}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(FRIENDLY_MESSAGES[0], 0);
  }

  if (options.raw && response.ok) return response as unknown as T;

  if (response.status === 204) return undefined as T;

  let payload: { message?: string; errors?: Record<string, string[]> } & Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      tokenStorage.clear();
      unauthorizedHandler?.();
    }
    const fallback = FRIENDLY_MESSAGES[response.status] ?? 'Não foi possível concluir a operação. Tente novamente.';
    const message = response.status >= 500 ? fallback : (payload.message as string) || fallback;
    if (response.status >= 500) {
      Sentry.captureMessage(`API ${response.status} em ${path}`, 'error');
    }
    throw new ApiError(message, response.status, payload.errors ?? {});
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),

  /** Baixa um arquivo autenticado (CSV/PDF/JSON) e dispara o download no navegador. */
  download: async (path: string, query: Query, fallbackName: string) => {
    const response = await request<Response>(path, { query, raw: true });
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = match?.[1] ?? fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export function errorMessage(err: unknown, fallback = 'Não foi possível concluir a operação.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.name !== 'AbortError') return fallback;
  return fallback;
}

<?php

namespace App\Services\Payments\Asaas;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Único ponto de saída HTTP do adaptador. Cada requisição:
 *  - só vai para a URL exata do Sandbox e para caminhos de uma lista fechada;
 *  - consome o orçamento da sua operação ANTES de ser enviada (esgotado = nenhuma requisição);
 *  - não segue redirecionamentos e não tem repetição automática;
 *  - registra só operação, método, caminho e status (nunca chave, cabeçalhos ou corpos).
 */
class AsaasHttp
{
    private const PATH = '#^/(customers|payments)(/[A-Za-z0-9_]+(/pixQrCode)?)?$#';

    public function __construct(private readonly AsaasConfig $config) {}

    /** @return array<string,int> requisições já feitas por operação */
    public function ledger(): array
    {
        return collect(AsaasConfig::OPERATIONS)->mapWithKeys(fn ($op) => [$op => (int) Cache::get("asaas:ledger:{$op}", 0)])->all();
    }

    /**
     * @return array<string,mixed> corpo JSON decodificado (2xx)
     *
     * @throws AsaasRefusedException    nada foi enviado (orçamento esgotado/indisponível, operação ou caminho fora da lista)
     * @throws AsaasTransportException  enviada, resultado incerto: rede, timeout, redirecionamento, 4xx, 5xx ou corpo inválido
     */
    public function send(string $op, string $method, string $path, array $query = [], ?array $json = null): array
    {
        in_array($op, AsaasConfig::OPERATIONS, true) || throw new AsaasRefusedException('Operação desconhecida.');
        preg_match(self::PATH, $path) === 1 || throw new AsaasRefusedException('Caminho não permitido.');

        $this->reserve($op);

        $options = array_filter(['query' => $query ?: null, 'json' => $json]);
        try {
            $response = Http::withHeaders(['access_token' => $this->config->key, 'User-Agent' => 'BoiNaRede-prototipo'])
                ->acceptJson()
                ->withOptions(['allow_redirects' => false])
                ->timeout($this->config->timeout)
                ->connectTimeout(5)
                ->send($method, $this->config->url.$path, $options);
        } catch (ConnectionException) {
            Log::info('asaas.request', ['op' => $op, 'method' => $method, 'path' => $path, 'result' => 'connection_error']);
            throw new AsaasTransportException('Falha de conexão ou timeout.');
        }

        $status = $response->status();
        Log::info('asaas.request', ['op' => $op, 'method' => $method, 'path' => $path, 'status' => $status]);

        if ($status >= 300 && $status < 400) {
            throw new AsaasTransportException('Redirecionamento recusado.');
        }
        if ($status === 408 || $status >= 500) {
            throw new AsaasTransportException("Resposta {$status} do servidor.");
        }
        if ($status < 200 || $status >= 300) {
            // Já foi enviada: sem contrato verificado, 4xx não prova que nada foi criado (resultado incerto).
            throw new AsaasClientErrorException("Resposta {$status}: a requisição foi enviada e o resultado é tratado como incerto.");
        }
        $body = $response->json();
        is_array($body) || throw new AsaasTransportException('Resposta sem JSON válido.');

        return $body;
    }

    /**
     * Reserva uma unidade do orçamento ANTES do envio: incrementa e só então compara. Falha fechado: erro do cache,
     * retorno que não seja inteiro positivo ou estouro do teto => nenhuma requisição. Se a devolução da unidade
     * falhar, o contador fica alto (erra para o lado seguro). Atomicidade entre processos depende do driver
     * (AsaasConfig::ATOMIC_CACHE_DRIVERS); o contador vive no cache e `cache:clear` o zera.
     *
     * @throws AsaasRefusedException nada foi enviado
     */
    private function reserve(string $op): void
    {
        $key = "asaas:ledger:{$op}";
        try {
            Cache::add($key, 0);
            $used = Cache::increment($key);
        } catch (\Throwable) {
            throw new AsaasRefusedException('Contador de orçamento indisponível; nada foi enviado.');
        }
        if (! is_int($used) || $used < 1) {
            throw new AsaasRefusedException('Contador de orçamento inválido; nada foi enviado.');
        }
        if ($used > $this->config->budget[$op]) {
            try {
                Cache::decrement($key);
            } catch (\Throwable) {
            }
            throw new AsaasRefusedException("Orçamento de requisições '{$op}' esgotado.");
        }
    }
}

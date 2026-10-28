<?php

namespace Tests\Support;

use App\Services\Payments\Asaas\AsaasConfig;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * Servidor Asaas FALSO para testes (nenhuma rede). Cada rota tem um comportamento programável em $b:
 *   customer_create: ok | timeout | timeout_lost | invalid | 422 | 500
 *   customer_list:   ok | 500            (+ customer_list_has_more)
 *   create:          ok | timeout | timeout_lost | redirect | 500 | 422 | override   (+ create_override, create_unset)
 *   qr:              ok | 500 | invalid
 *   get:             ok | timeout | 500                                           (+ get_override, get_unset)
 *   list:            ok | 500                                                     (+ list_extra, list_has_more, list_malformed)
 * $log guarda toda requisição recebida (método, caminho, consulta, corpo, chave enviada).
 */
final class AsaasFakeServer
{
    public array $b = [];
    public array $log = [];
    public array $payments = [];
    public array $customers = [];
    private int $n = 0;

    public static function install(array $behaviors = []): self
    {
        $s = new self();
        $s->b = $behaviors;
        Http::fake(fn (Request $r) => $s->handle($r));

        return $s;
    }

    public function count(?string $method = null, ?string $pathPrefix = null): int
    {
        return count(array_filter($this->log, fn ($e) => ($method === null || $e['method'] === $method) && ($pathPrefix === null || str_starts_with($e['path'], $pathPrefix))));
    }

    public function handle(Request $r)
    {
        $url = $r->url();
        $rel = str_starts_with($url, AsaasConfig::SANDBOX_URL) ? substr($url, strlen(AsaasConfig::SANDBOX_URL)) : null;
        [$path, $qs] = array_pad(explode('?', (string) $rel, 2), 2, '');
        parse_str($qs, $query);
        $this->log[] = ['method' => $r->method(), 'path' => $path, 'query' => $query, 'body' => $r->data(), 'key' => $r->header('access_token')[0] ?? null, 'foreign' => $rel === null ? $url : null];
        if ($rel === null) {
            return Http::response(['errors' => 'host desconhecido'], 500);
        }
        $m = $r->method();

        if ($m === 'POST' && $path === '/customers') {
            return $this->customerCreate($r->data());
        }
        if ($m === 'GET' && $path === '/customers') {
            return $this->customerList();
        }
        if ($m === 'POST' && $path === '/payments') {
            return $this->create($r->data());
        }
        if ($m === 'GET' && $path === '/payments') {
            return $this->list($query);
        }
        if ($m === 'GET' && preg_match('#^/payments/([A-Za-z0-9_]+)/pixQrCode$#', $path, $x)) {
            return $this->qr($x[1]);
        }
        if ($m === 'GET' && preg_match('#^/payments/([A-Za-z0-9_]+)$#', $path, $x)) {
            return $this->get($x[1]);
        }

        return Http::response(['errors' => 'rota desconhecida'], 404);
    }

    private function customerCreate(array $body)
    {
        $mode = $this->b['customer_create'] ?? 'ok';
        if ($mode === '422') {
            return Http::response(['errors' => [['description' => 'dados inválidos']]], 400);
        }
        if ($mode === '500') {
            return Http::response('erro', 500);
        }
        $c = ['object' => 'customer', 'id' => 'cus_NOVO0001', 'name' => $mode === 'invalid' ? 'OUTRO NOME' : $body['name'], 'cpfCnpj' => $body['cpfCnpj'],
            'externalReference' => $body['externalReference'], 'deleted' => false];
        if ($mode !== 'timeout_lost') {
            $this->customers[$c['id']] = $c;
        }
        if (in_array($mode, ['timeout', 'timeout_lost'], true)) {
            throw new ConnectionException('timeout');
        }

        return Http::response($c);
    }

    private function customerList()
    {
        if (($this->b['customer_list'] ?? 'ok') === '500') {
            return Http::response('erro', 500);
        }

        return Http::response(['object' => 'list', 'hasMore' => $this->b['customer_list_has_more'] ?? false, 'data' => array_values($this->customers)]);
    }

    private function create(array $body)
    {
        $mode = $this->b['create'] ?? 'ok';
        if ($mode === 'redirect') {
            return Http::response('', 302, ['Location' => 'https://evil.example/payments']);
        }
        if ($mode === '500') {
            return Http::response('erro', 500);
        }
        if ($mode === '422') {
            return Http::response(['errors' => [['description' => 'chave sk_secreta_no_corpo']]], 400);
        }
        $id = 'pay_T'.str_pad((string) ++$this->n, 6, '0', STR_PAD_LEFT);
        $p = ['object' => 'payment', 'id' => $id, 'customer' => $body['customer'], 'billingType' => 'PIX', 'value' => $body['value'],
            'status' => 'PENDING', 'dueDate' => $body['dueDate'], 'externalReference' => $body['externalReference'], 'deleted' => false];
        if ($mode === 'override') {
            $p = array_replace($p, $this->b['create_override'] ?? []);
            foreach ($this->b['create_unset'] ?? [] as $k) {
                unset($p[$k]);
            }
        }
        if ($mode !== 'timeout_lost' && isset($p['id'])) {
            $this->payments[$id] = $p;
        }
        if (in_array($mode, ['timeout', 'timeout_lost'], true)) {
            throw new ConnectionException('timeout');
        }

        return Http::response($p);
    }

    private function list(array $query)
    {
        if (($this->b['list'] ?? 'ok') === '500') {
            return Http::response('erro', 500);
        }
        $items = array_values(array_filter($this->payments, fn ($p) => ($p['externalReference'] ?? null) === ($query['externalReference'] ?? null)));
        $items = array_merge($items, $this->b['list_extra'] ?? []);
        if ($this->b['list_malformed'] ?? false) {
            $items[] = 'nao-e-objeto';
        }

        return Http::response(['object' => 'list', 'hasMore' => $this->b['list_has_more'] ?? false, 'data' => $items]);
    }

    private function qr(string $id)
    {
        $mode = $this->b['qr'] ?? 'ok';
        if ($mode === '500') {
            return Http::response('erro', 500);
        }
        if ($mode === 'invalid') {
            return Http::response(['success' => true, 'payload' => '', 'encodedImage' => '<script>']);
        }

        return Http::response(['success' => true, 'encodedImage' => 'QUJD', 'payload' => '00020126PIXTESTE'.$id, 'expirationDate' => '2026-12-31 23:59:59']);
    }

    private function get(string $id)
    {
        $mode = $this->b['get'] ?? 'ok';
        if ($mode === 'timeout') {
            throw new ConnectionException('timeout');
        }
        if ($mode === '500' || ! isset($this->payments[$id])) {
            return Http::response('erro', $mode === '500' ? 500 : 404);
        }
        $p = array_replace($this->payments[$id], $this->b['get_override'] ?? []);
        foreach ($this->b['get_unset'] ?? [] as $k) {
            unset($p[$k]);
        }

        return Http::response($p);
    }

    /** Simula o pagamento da cobrança no Sandbox (só altera o estado do servidor falso). */
    public function pay(string $id, string $status = 'RECEIVED'): void
    {
        $this->payments[$id]['status'] = $status;
    }
}

# Contribuição — Entrega 01: jornada de cobrança Pix (protótipo simulado)

Para revisão do colega e do professor. **Nada aqui foi validado contra o Asaas.** O registro detalhado, com decisões e
limitações de cada etapa, está em [`ENTREGA-01-COBRANCA-PIX.md`](ENTREGA-01-COBRANCA-PIX.md).

## O que esta contribuição entrega
1. **Jornada Pix com gateway SIMULADO (padrão, `PAYMENT_GATEWAY=simulated`).** Preço e identidade vêm do anúncio no banco;
   a cobrança é criada uma única vez; resultado incerto nunca é repetido; o pagamento só é confirmado depois de consultar o
   gateway e validar id, referência, valor e status. Confirmação rotulada como SIMULADA; não vira receita nem libera envio.
2. **Webhook LOCAL e SIMULADO** (`POST /api/webhooks/simulated-pix`): aviso fictício com token de teste que apenas aciona a
   mesma conferência; o conteúdo do aviso nunca confirma pagamento. Desligado sem `SIMULATED_WEBHOOK_TOKEN` e inexistente com
   o gateway do Sandbox. **Não é o webhook do Asaas.**
3. **Adaptador do Asaas Sandbox (código local, NÃO validado).** Só é ativado com `PAYMENT_GATEWAY=asaas_sandbox` e configuração
   completa; foi testado apenas com respostas HTTP falsas. Inclui orçamento de requisições persistente no banco
   (`asaas_request_budget`). Nenhuma requisição ao Asaas foi feita, nenhuma credencial usada, nenhuma janela de Sandbox aberta.

## O que NÃO foi validado
- Integração com o Asaas (contrato da API presumido), Sandbox, webhook real do Asaas, exposição pública.
- Incorporação e testes no ambiente do colega (etapa futura).
- Telas fora da jornada de compra (vendedor, admin) não foram verificadas visualmente.
- Pendências conhecidas: pedidos antigos sem `gateway_id`, sem expiração de pedido/reserva.

## Mudanças que tocam código existente (revisar com atenção)
`OrderController`, `Order`, `Payment` (relações), `Presenter`, `AdminController` (receita/comissão ignoram pagamento de teste),
`AppServiceProvider` (escolha do gateway), `routes/api.php`, `config/boinarede.php` e `config/services.php`, `phpunit.xml` e
`tests/TestCase.php` (testes forçados a SQLite em memória; abortam se a conexão não for isolada), e telas `Checkout`,
`PurchaseDetail`, `MyPurchases`, `MySales`, `Dashboard`, `AdminSales`, `AdminSaleDetail`.

## Migrações (aplicar só em banco de teste/novo; revisar antes de qualquer banco existente)
- `2026_10_27_100000_add_pix_journey_columns_to_payments`: 5 colunas novas e anuláveis em `payments`.
- `2026_10_28_100000_create_asaas_request_budget_table`: tabela nova do orçamento do Asaas. **Só importa com o Sandbox**;
  com o gateway simulado não é usada. Rodá-la começa os contadores em zero.

## Como reproduzir os testes (isolado, sem rede, sem `.env`)
Na pasta `backend/`, com `composer install` feito e uma `APP_KEY` qualquer:
```
APP_KEY=base64:$(php -r 'echo base64_encode(random_bytes(32));') vendor/bin/phpunit
```
Resultado observado na versão final: **135 testes, 723 asserções, OK** (em contêiner com `--network none`, SQLite em memória).
Obs.: `php artisan test` mostrou avisos de causa não determinada nesta máquina; a referência é `vendor/bin/phpunit`.

## Como reproduzir a demonstração simulada (banco NOVO, nunca o de desenvolvimento)
1. Banco SQLite novo ou MySQL descartável; `php artisan migrate`; criar 2 usuários e 1 anúncio fictícios.
2. Definir `PAYMENT_GATEWAY=simulated` (padrão) e, para o webhook, `SIMULATED_WEBHOOK_TOKEN=<valor fictício>`.
3. Como comprador: anúncio → **Comprar agora** → Pix → **Confirmar compra** → **Simular pagamento no gateway de demonstração**.
4. Confirmar por **Conferir pagamento** (manual) **ou** pelo webhook local:
   `curl -X POST <host>/api/webhooks/simulated-pix -H "X-Webhook-Token: <token>" -H "Content-Type: application/json" -d '{"payment":{"id":"<gateway_id>","externalReference":"<código do pedido>","value":<valor>}}'`
5. A tela passa a "Pago (simulado)". Observado em 28/10/2026 num ambiente isolado (dados fictícios, loopback), não no ambiente do colega.

## Segurança e privacidade desta contribuição
Sem chaves, tokens reais, bancos, backups ou imagens no pacote; os valores de teste são fictícios. Os testes nunca leem `.env`
nem chamam rede. O `.env.example` já trazia (na `main`) `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` com marcadores `COLE_AQUI_...` (não são segredos); esta contribuição só acrescenta, comentada, a variável `SIMULATED_WEBHOOK_TOKEN`.

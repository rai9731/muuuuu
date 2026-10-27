# Entrega 01 — Jornada de cobrança Pix (protótipo acadêmico, gateway SIMULADO)

Contribuição para revisão. Nada aqui chama o Asaas, usa credenciais ou cria cobrança externa.

## Percurso
`Comprar agora` (CowDetail) → `/checkout/{id do anúncio}` → `POST /api/checkout/{id}` → pedido + cobrança Pix → `/minhas-compras/{id}` (jornada) → `Conferir pagamento`.

- **Fonte de identidade e preço:** a linha do anúncio no banco (`cows`). O navegador só envia `payment_method` (agora só `pix`) e `delivery_method`; qualquer `price`/`total`/`cow_id` extra é ignorado.
- **Valor cobrado:** `orders.total` (preço + comissão, regra já existente em `OrderController::amounts`). Veja "Pontos para o colega decidir".

## Etapas exibidas (`Presenter::journey`)
Venda registrada → Cobrança preparada/criada (ou "resultado incerto"/"divergente") → Aguardando pagamento → Conferindo pagamento → Pagamento confirmado (com a origem: simulação ou gateway).

## Regras
- **Clique repetido/recarga:** o mesmo comprador reaproveita o pedido em aberto do animal (200, sem novo pedido nem cobrança).
- **Criação da cobrança:** uma tentativa por estado `preparing` (reivindicada sob lock, chamada ao gateway fora da transação). Recusa definitiva → volta a `preparing` (nova tentativa só por ação explícita). Timeout/erro/resposta inválida → `uncertain`, **nunca repetido sozinho**; "Conferir" procura por referência (código do pedido) e vincula sem criar outra.
- **Confirmação:** só em `PixPaymentService::verify`: consulta o gateway e exige id, referência = código do pedido, valor = valor gravado = total do pedido e status `RECEIVED`/`CONFIRMED`. Pendente, erro de rede, divergência ou status não pago **não** confirmam.
- **Simulação:** `simulate-payment` só marca "recebido" no gateway simulado; o pedido continua aguardando até `check-payment`. A confirmação é gravada com `confirmation_source = simulation` e rotulada como simulada na tela e nas notificações.
- Pagamento (simulado ou não) **não** vende o animal nem altera estoque; a reserva existente no checkout foi mantida.

## Arquivos
Backend: `app/Services/Payments/*` (contrato `PixGateway`, `SimulatedPixGateway`, `PixPaymentService`), `OrderController`, `Presenter`, `Payment` (cast), migration `2026_10_27_100000_*`, `routes/api.php` (`check-payment`), `config/boinarede.php` (`PAYMENT_GATEWAY`, padrão `simulated`), `AppServiceProvider`.
Frontend: `PurchaseDetail`, `Checkout`, `components/ui/PaymentJourney.tsx`, `services/{orderService,types}.ts`, `utils/constants.ts`.
Testes: `backend/tests/Feature/PixJourneyTest.php`.

## Como testar
`docker compose exec app php artisan test` (SQLite em memória; gateway de teste programável). Requer rodar a migration em bancos existentes: `php artisan migrate`.

## Não feito (fora da Entrega 01)
Adaptador do Asaas (a troca é uma classe que implemente `PixGateway` + ramo no `AppServiceProvider`), webhook, expiração/cancelamento automático, cartão e boleto (removidos do checkout nesta jornada).

## Pontos para o colega revisar
1. Regra de preço e comissão: ver "Regra de preço e comissão (opção A)" abaixo (a divergência inicial foi resolvida pelo responsável).
2. O checkout já reservava o animal ao criar o pedido; mantido sem alteração.
3. Cartão/boleto saíram da tela de checkout (a jornada é Pix); o código antigo de `simulate-payment` com confirmação direta foi substituído.

---

## Pacote de preparação da demonstração (27/10/2026)

### Regra de preço e comissão (opção A, decidida pelo responsável)
O preço do anúncio é o total que o comprador paga. A comissão existente (5%, `Setting::commission()`) não muda; ela é descontada do repasse. Fonte do preço: `cows.price` no banco, recalculado em `OrderController::amounts()`. Exemplo: anúncio R$ 3.900,00 → total R$ 3.900,00, comissão R$ 195,00, repasse R$ 3.705,00. Pedidos antigos (gravados com preço + comissão) não foram alterados.

### Confirmação simulada
Mensagem do backend, toast, selos (pedido e pagamento), Timeline e notificações dizem "SIMULADO/SIMULADA". O aviso ao vendedor passa a "Pagamento SIMULADO — não envie o animal". Painel do vendedor (`total_sold`) e painel/relatórios do admin (receita e comissões) ignoram pedidos com pagamento simulado (`Order::excludingSimulated`).
Correção colateral: `Payment` não tinha as relações `order`/`payer` usadas pelo painel admin (dava 500 com qualquer pagamento); foram adicionadas.

### Testes isolados
`phpunit.xml` força SQLite em memória e cache em array, e `tests/TestCase.php` força o mesmo antes de o Laravel ler o ambiente e **aborta** se a conexão não for SQLite em memória/temporário. Necessário porque o container exporta `DB_CONNECTION=mysql` e variáveis já exportadas vencem o `phpunit.xml`.

### Como conferir o MySQL de desenvolvimento (somente leitura, feito por você)
Nada foi consultado nem alterado pelo executor. Para conferir se os dados de demonstração existem e se a migração desta entrega foi aplicada, no cliente MySQL de sua preferência (porta 3307 do host), apenas com `SELECT`:
- `SELECT COUNT(*) FROM users;` e `SELECT COUNT(*) FROM cows;` (esperado, com a demonstração: 3 usuários e 3 anúncios, além do que você criou)
- `SELECT migration FROM migrations ORDER BY id DESC LIMIT 3;` (se aparecer `2026_10_27_100000_add_pix_journey_columns_to_payments`, a migração foi aplicada)
Se faltar dado, preserve o estado e decida entre `php artisan db:seed` ou restauração de backup antes de agir.

### Pendências (não corrigidas neste pacote)
- **Pedidos antigos sem saída:** `Payment` pendente sem `gateway_id` (criado antes da migração) não pode ser conferido nem simulado. Sem migração de dados.
- Baixa: conferências simultâneas podem devolver "pending" após outra já ter confirmado (estado correto); conferência em pedido cancelado devolve "pending".
- Preexistente: não há expiração/cancelamento automático do pedido, e a reserva do animal não expira.
- Fluxo preexistente: em pedido com pagamento simulado, o comprador ainda vê "Confirmar recebimento" e o vendedor "Marcar em transporte" (a tela do vendedor foi marcada como "Simulado: não enviar"); concluir a entrega marcaria o animal como vendido.
- Sem teste concorrente, sem teste de frontend e sem teste de segundo comprador em animal reservado.

### Conferência de fechamento (27/10/2026)
- **Testes:** a suíte completa tem 25 testes em 4 arquivos (`Unit/ExampleTest`, `Unit/DatabaseSafetyTest`, `Feature/ExampleTest`, `Feature/PixJourneyTest`). `docker compose exec app php artisan test` e `vendor/bin/phpunit` rodam todos e passam: `OK (25 tests, 126 assertions)`. O resumo do `php artisan test` mostrava "1 passed, 24 warnings" neste commit (e21151a) e mostra "1 passed, 26 warnings" no commit atual (cc1d4dd); o PHPUnit nativo não reportou aviso algum. **A causa desses avisos permanece não determinada.** As mensagens visíveis (truncadas) mencionam `file_get_contents(/var/www/html/.env)`, e o container não tem `.env`, mas essa relação é apenas uma hipótese, não uma causa comprovada. Um aviso semelhante já aparecia no `ExampleTest` antes da Entrega 01.
- **Pagamento simulado e animal (efeito atual, sem regra nova):** o comprador só confirma recebimento com o pedido em `in_transit`, e só o vendedor leva um pedido de `paid` a `in_transit`. Um pedido simulado pode, portanto, chegar a `delivered` e marcar o animal como `sold` se o vendedor clicar em "Marcar em transporte" e o comprador confirmar o recebimento. Fora da demonstração: esse caminho não é exercitado. Proposta de proteção (NÃO implementada, aguarda decisão): recusar `ship` (422) quando o pagamento é simulado e ocultar os botões de envio e de recebimento nesses pedidos. Efeito: o pedido simulado fica em `paid` e o animal em `reserved`; como a reserva não expira, o anúncio continua fora da vitrine até alguém liberá-lo. Isso exigiria uma segunda decisão (cancelar o pedido simulado / liberar a reserva).
- **MySQL de desenvolvimento:** possível uso anterior pelos testes das etapas anteriores **não confirmado**. Nada foi consultado nem alterado.
- **Fotos da demonstração anterior:** alteração **não verificada**. Evidência apenas observada (sem restaurar nada): os 3 arquivos em `backend/storage/app/public/cows/{1,2,3}/` têm data de modificação 27/10/2026 18:44 (as pastas, 16:00) e conteúdo idêntico (SHA-256) ao das fontes em `backend/database/seeders/images/`.

### Bloqueio de envio/entrega para pagamento simulado (27/10/2026, decisão do responsável)
- Backend: `ship` e `confirm-delivery` recusam (422) pedidos cujo pagamento é simulado (`Order::hasSimulatedPayment`). Interface: botões "Marcar em transporte" e "Confirmar recebimento" ocultos nesses pedidos, com aviso.
- **Efeito aceito:** o pedido demonstrativo permanece `paid` e o animal `reserved`; não há cancelamento, expiração nem liberação automática da reserva (não implementados).
- Testes novos: envio e entrega recusados e animal inalterado; pedido com gateway não simulado continua podendo ser enviado.
- Suíte nativa após o ajuste: `OK (27 tests, 139 assertions)` (antes do ajuste: 25 testes, 126 asserções).
- A demonstração para em "Pagamento confirmado (simulado)", em banco isolado.

### Correções e itens não verificados (registro documental)
- **Avisos do `php artisan test`:** 26 no commit atual (cc1d4dd) e 24 em e21151a; causa não determinada (ver o item "Testes" acima). Não são falhas do PHPUnit nem problema resolvido. Mantidos separados do resultado do PHPUnit nativo.
- **PHPUnit nativo no commit atual (cc1d4dd):** `OK (27 tests, 139 assertions)`, segundo o executor. A linha de base de e21151a era 25 testes e 126 asserções.
- **Não verificados:** a apresentação visual da tela do vendedor e as partes do painel administrativo que não foram examinadas (lista de Pagamentos, lista e detalhe de Vendas e a leitura dos valores na tela). Só os totais de receita e comissão do admin e o `total_sold` do vendedor têm teste.
- **Isolamento da demonstração:** o isolamento do MySQL foi por configuração (SQLite em `/tmp`, `DB_HOST` vazio); a rede `bridge` padrão não prova bloqueio de acesso externo. Não houve chamada externa observada, mas a execução não deve ser classificada como totalmente isolada da rede.

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

## Pontos para o colega decidir
1. O checkout mostra "você não paga nada a mais", mas `total = preço + comissão` e é esse valor que a cobrança usa. Mantive o comportamento existente.
2. O checkout já reservava o animal ao criar o pedido; mantido sem alteração.
3. Cartão/boleto saíram da tela de checkout (a jornada é Pix); o código antigo de `simulate-payment` com confirmação direta foi substituído.

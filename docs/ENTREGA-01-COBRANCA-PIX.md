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
- Fluxo preexistente, **parcialmente superado pelo commit cc1d4dd**: antes dele, um pedido com pagamento simulado podia ser enviado e entregue, o que marcaria o animal como vendido. **Superado (segundo os testes relatados):** o backend recusa `ship` e `confirm-delivery` (422) para pedidos com pagamento simulado e preserva o estado do pedido e do animal (pedido `paid`, `shipped_at` e `delivered_at` nulos, animal `reserved`). **Continua não verificado:** a apresentação visual das telas do comprador e do vendedor (inclusive se os botões "Confirmar recebimento" e "Marcar em transporte" estão ocultos ou substituídos como o código prevê) e as áreas administrativas que não foram examinadas.
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

### Aprovação da regra de preço A pelo responsável pelo Boi na Rede (27/10/2026)
- **Decisão:** em 27/10/2026, o responsável pelo Boi na Rede aprovou a regra de preço A, conforme informado por Rogers. Antes disso, a regra constava apenas como decisão de Rogers para este protótipo.
  - O preço exibido na vitrine é o total pago pelo comprador.
  - A comissão de 5% é descontada do repasse ao vendedor.
  - Exemplo (anúncio de R$ 3.900,00): o comprador paga R$ 3.900,00, a comissão é R$ 195,00 e o vendedor recebe R$ 3.705,00.
- **Correspondência com o código (conferida por leitura do commit 085ca41, sem rodar testes):** `OrderController::amounts()` calcula `fee = round(preço × comissão / 100, 2)`, `total = preço` e `seller_amount = preço − fee`, e o checkout grava `orders.total`, `orders.seller_amount` e `payments.amount` (igual ao total) a partir desses valores. O preço vem de `cows.price` no banco. A comissão (`Setting::commission()`, padrão 5 em `PLATFORM_COMMISSION_PERCENT`) não foi alterada. O texto do checkout informa que a taxa é descontada do repasse. O teste `test_regra_a_comprador_paga_o_preco_anunciado_e_comissao_reduz_o_repasse` verifica os valores 3900 / 3900 / 195 / 3705 (resultado relatado anteriormente, não reexecutado nesta etapa).
- **Escopo da aprovação:** a regra vale para pedidos novos; pedidos antigos continuam com o valor gravado na época. A aprovação não implica validação no Asaas Sandbox nem prontidão para produção.

---

## Adaptador do Asaas Sandbox: preparação local (27/10/2026, commit 77f18a4)

**Escopo:** só código e testes locais com respostas HTTP falsas. Nenhuma requisição de rede, credencial, `.env`, Asaas, painel, Sandbox ou webhook foi usada. Nenhum cliente ou cobrança foi criado. `PAYMENT_GATEWAY=simulated` continua sendo o padrão.

### Ativação (falha fechado)
`PAYMENT_GATEWAY=asaas_sandbox` só ativa o adaptador se TODAS as condições valerem (`AsaasConfig::fromConfig`); caso contrário lança `AsaasConfigurationException` e nenhuma requisição é possível:
- `ASAAS_ENV=sandbox` e `ASAAS_API_URL` exatamente igual a `https://sandbox.asaas.com/api/v3` (a URL prevista no projeto; produção, `http`, barra final, host parecido e URLs desconhecidas são recusados);
- `ASAAS_API_KEY` preenchida (a chave NÃO é reconhecida como "de Sandbox" pelo formato; a proteção é a URL, o ambiente e a autorização);
- `ASAAS_SANDBOX_AUTHORIZED=true` (autorização explícita da janela);
- cliente de teste: `ASAAS_TEST_CUSTOMER_ID` ou `ASAAS_TEST_CUSTOMER_NAME` + `ASAAS_TEST_CUSTOMER_DOCUMENT` (11 ou 14 dígitos);
- orçamento inteiro definido para cada operação (`ASAAS_BUDGET_*`; ausente ou inválido bloqueia a ativação, 0 bloqueia a operação).

### Requisições contabilizadas (`AsaasHttp`)
Única saída HTTP. Cada requisição consome o orçamento da sua operação ANTES de ser enviada (timeouts contam), vai só à URL exata e a caminhos de uma lista fechada, não segue redirecionamento (3xx é incerteza) e não tem repetição automática. Registra só operação, método, caminho e status (nunca chave, cabeçalhos ou corpos). Operações: `customer_create`, `customer_list`, `payment_create`, `qr`, `payment_get`, `payment_list`. O contador fica no cache (persistente com `CACHE_STORE=database`).

### Incerteza e reconciliação (nunca recria)
- **Cobrança:** timeout, 5xx, 408, redirecionamento ou resposta que não prove vínculo => incerto; o pedido fica `uncertain`. A conferência do comprador só LÊ: lista por `externalReference` e aceita candidatas do cliente de teste, modalidade PIX e estrutura válida, com lista completa (`hasMore=false`). Mais de uma candidata => divergente; nenhuma => "não encontrada" (nada é criado). `externalReference` sozinha não prova vínculo nem unicidade.
- **Cliente de teste:** grava o estado `creating` antes de enviar; timeout ou resposta inválida => `uncertain`, a cobrança nem é enviada (`GatewayRejected`) e nenhuma nova criação é feita enquanto o estado não for reconciliado. `php artisan asaas:reconcile-customer` faz uma listagem (só leitura) e adota o cliente se houver exatamente um com os dados de teste; `--release-if-not-found` libera o estado só se a listagem concluir que não existe. Esse comando é ação humana de uma janela autorizada.
- Pedido que ficou `uncertain` e "não encontrado" não tem nova criação automática (regra existente); a retomada é decisão de Rogers na janela.

### Validação antes de associar ou confirmar
Identidade (`pay_*`, igual ao consultado), objeto `payment`, cliente de teste, modalidade `PIX`, status conhecido (lista fechada), não removida, valor numérico, `externalReference` presente e, se houver campo `currency`, igual a `BRL`. Valor e referência divergentes voltam ao serviço, que marca "divergente". O serviço continua exigindo referência = código do pedido, valor = valor gravado = total, e status `RECEIVED`/`CONFIRMED`. Resposta ausente, inválida, incompleta, divergente, 4xx/5xx ou com status desconhecido não confirma nada.

### Apresentação da confirmação no Sandbox
`payments.gateway = asaas_sandbox` e `confirmation_source = asaas_sandbox`, distintos de `simulated`. Jornada: "Confirmado no Asaas SANDBOX (teste): não é pagamento real nem receita real"; toast, selos ("Sandbox — teste") e Timeline ("Pagamento confirmado (SANDBOX — teste)") dizem o mesmo. O vendedor recebe "Pagamento de TESTE (Sandbox) — não envie o animal"; `ship` e `confirm-delivery` recusam (422) qualquer pagamento de teste (simulado ou Sandbox); receita e comissão do admin e `total_sold` do vendedor excluem ambos (`Order::TEST_GATEWAYS`). Verificado por testes de API e por leitura do código; as telas NÃO foram abertas (não verificado visualmente). O botão de simulação só existe no gateway simulado.

### Dado de teste: pendente antes de qualquer janela externa
Não há dado de teste definido. Nenhum dado real foi usado ou inventado, e não foram feitas chamadas para descobrir quais identificadores o Sandbox aceita. É provável que o Sandbox rejeite documentos inválidos; a escolha de um cliente de teste adequado (de preferência criado por Rogers no painel e informado por `ASAAS_TEST_CUSTOMER_ID`, sem requisição de criação) precisa ser resolvida antes da janela.

### Premissas não verificadas (sem rede nem documentação consultada)
URL do Sandbox e formato das respostas (campos `customer`, `billingType`, `externalReference`, `hasMore`, `pixQrCode`), lista de status, ausência de campo de moeda, formato de `cpfCnpj` e o parâmetro `limit` seguem o conhecimento geral da API e a configuração do projeto. Um contrato divergente faria o adaptador recusar ou ficar inconclusivo (nunca confirmar), mas só uma janela real o comprova.

### Orçamento por requisição para uma janela futura (proposta, não executada)
Caminho feliz com cliente pré-criado: 1 `payment_create` + 1 `qr` + 2 `payment_get` (pendente e pago) = 4 requisições. Com resultado incerto na criação: +1 `payment_list` +1 `qr`. Cliente criado pela aplicação: +1 `customer_create` (+1 `customer_list` para reconciliar). Sugestão de teto: `customer_create` 1, `customer_list` 1, `payment_create` 1, `qr` 2, `payment_get` 4, `payment_list` 1 (total 10). Cada clique em "Conferir pagamento" consome 1 `payment_get`; esgotado o orçamento, a conferência fica inconclusiva sem requisição.

### O que uma janela no Sandbox poderia deixar
- No Asaas Sandbox: 1 cobrança Pix (pode permanecer pendente e continuar pagável após o vencimento), possivelmente 1 cliente de teste e, se pago no painel, um pagamento registrado. Pode não ser removível por completo. O cliente é criado com notificações desligadas.
- Local (SQLite temporário): pedido, pagamento, reserva do animal, estado do cliente de teste (`settings`), contador de requisições (cache) e linhas de log sem segredos.

### Resultados dos testes deste pacote (executados agora, ambiente isolado)
- `vendor/bin/phpunit` (suíte nativa): `OK (89 tests, 425 assertions)`; dos quais 62 testes e 286 asserções são de `AsaasSandboxAdapterTest`.
- `php artisan test`: `88 warnings, 1 passed (425 assertions)`. Mesma natureza dos avisos anteriores; causa não determinada (hipótese não confirmada: leitura do `.env` ausente). Não são falhas do PHPUnit.
- Testes de mutação pontuais: removida a validação de status e a de paginação, 4 testes falharam (detecção confirmada); código restaurado.
- `tsc --noEmit` e `eslint`: sem erros. Build do frontend (`vite build` para pasta temporária): concluído.
- Descoberta de ambiente: o container recebe `ASAAS_*` preenchidas via `env_file: .env` do Compose (valores não lidos nem exibidos). Os testes agora as zeram em `TestCase::createApplication` e bloqueiam qualquer requisição HTTP sem fake (`Http::preventStrayRequests`); um teste confirma que `services.asaas.*` fica vazio nos testes. Execuções anteriores de testes podem ter carregado essas variáveis na memória do processo (sem nenhum código que as usasse). Demonstrações feitas com `docker compose run` herdaram as variáveis no ambiente do container.
- Limitações: sem teste de tela (nenhuma tela aberta), sem teste concorrente e sem contrato real do Asaas.

---

## Revisão local da candidata do adaptador (27/10/2026, commit 5f249da)

Escopo: revisão do código e dos testes da candidata (`77f18a4`, `6536cc7`) antes de qualquer janela externa. Sem rede, credencial, `.env`, Asaas, Sandbox ou webhook.

**Defeitos corrigidos**
- O contador de orçamento (`AsaasHttp`) lia e gravava em passos separados: duas requisições simultâneas podiam passar pelo mesmo saldo. Agora a reserva é atômica (incrementa e só então compara; ao estourar, devolve a unidade e recusa).
- Pagamento de teste (simulado ou Sandbox) marcava `payout_status = pending`, e as telas de vendedor e admin mostravam "Repasse pendente", como se houvesse repasse devido. Agora o repasse permanece `not_applicable` para gateways de teste.

**Estado incerto e intervenção**
- Cobrança: o pagamento fica `uncertain`; a conferência só lê (`findByReference`) e nunca cria. Intervenção: nenhuma obrigatória; se a listagem não achar, continua incerto até decisão humana na janela.
- Cliente de teste: `settings.asaas_sandbox_customer` guarda `creating`/`uncertain`/`ready`. Qualquer estado diferente de `ready` bloqueia nova criação. Intervenção: `php artisan asaas:reconcile-customer` (somente leitura) e, só se concluir "não encontrado", `--release-if-not-found`. Um processo que morra durante a criação deixa `creating`, tratado como incerto.

**Alcance do isolamento dos testes (honesto)**
- `TestCase` força SQLite em memória, cache em array, zera `ASAAS_*` e `PAYMENT_GATEWAY=simulated`, aborta se a conexão não for SQLite em memória/temporária e chama `Http::preventStrayRequests()`. Isso impede o código de teste (framework) de usar MySQL ou uma requisição HTTP sem fake. Não é isolamento de rede do container: um processo fora do cliente HTTP do Laravel não é bloqueado.

**Testes desta revisão**
- `vendor/bin/phpunit`: OK (90 tests, 435 assertions). `tsc --noEmit` e `eslint`: sem erros. `vite build` (pasta temporária): concluído.
- Não executado: demonstração visual (exigiria subir servidor), teste concorrente real, contrato real do Asaas.

**Premissas do contrato do Asaas continuam não verificadas** (ver seção do adaptador): campos e status das respostas, moeda, `cpfCnpj`, `limit` e `hasMore`.

---

## Rodada local após o parecer do auditor (27/10/2026): M1, M2, M3, B1

**M1 — liberação do cliente de teste.** `--release-if-not-found` só libera após listagem completa (`hasMore=false`), válida e *literalmente vazia*. Lista não vazia sem correspondência estrita (referência certa com nome ou documento divergente, cliente removido, ou correspondente mais um item divergente) é `ambiguous`; nunca libera. Mesmo uma listagem vazia não prova que não há criação ainda em andamento (estado `creating` de um processo vivo): quem executa precisa confirmar isso antes; o comando avisa. Testes: 4 listas divergentes, lista vazia incompleta e lista vazia completa.

**M2 — respostas 4xx.** O contrato do Asaas não foi verificado, então 4xx deixa de ser "recusa conclusiva": após o envio é resultado incerto (`AsaasClientErrorException`, subclasse de transporte). Só é "rejeição" (e só então a trava é liberada) quando nada foi enviado: orçamento esgotado ou indisponível. Cliente: 4xx => `uncertain`. Cobrança: 4xx => pedido `uncertain`, conferência só lê. Defesa adicional: uma tentativa de criação por referência (`asaas:create-attempt:{ref}` no cache); segundo POST para a mesma referência não é enviado mesmo com orçamento sobrando. Testes: 4xx/5xx não reabrem a criação (adaptador e API), cliente 4xx não gera novo POST, orçamento zero libera a trava. Não há exceção documentada para recusa conclusiva: seria preciso fundamento do contrato real.

**M3 — orçamento.** A reserva falha fechada: exceção do cache, retorno não inteiro ou menor que 1 => nada é enviado. Se a devolução da unidade falhar, o contador fica alto (lado seguro). A ativação do adaptador exige cache `database`, `redis` ou `memcached` (`array`/`file` só em ambiente de teste). **Não comprovado:** a atomicidade entre processos desses drivers (depende do banco/servidor de cache; nenhum teste concorrente real foi feito, e o cache `array` não representa uma janela real). Condições a provar antes do Sandbox: driver escolhido, incremento atômico sob concorrência no ambiente real, e não executar `cache:clear` durante a janela (o contador é cache). Um processo que morra entre a reserva e o envio consome orçamento sem enviar (conservador).

**B1 — regressão.** `test_reserva_do_orcamento_nao_depende_de_leitura_defasada` usa um cache cuja leitura é defasada (simula outro processo) e incremento real. Na versão de `6536cc7` (leitura e gravação separadas) o teste **falha**: 6 requisições enviadas em vez de 2 (`Failed asserting that 6 is identical to 2`); o teste sequencial anterior passava nas duas versões. Na versão atual passa. Demonstração feita trocando temporariamente o arquivo pela versão de `6536cc7` e restaurando-o.

**Testes:** `vendor/bin/phpunit` (isolado pelo `TestCase`, SQLite em memória, HTTP falso): OK (101 tests, 532 assertions). Limites: o `AsaasFakeServer` segue com contrato presumido; sem teste concorrente real; telas não verificadas visualmente.

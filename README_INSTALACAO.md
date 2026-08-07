# CLENA DELIVERY + MERCADO PAGO — pacote completo

Este pacote preserva o HTML original e adiciona pagamento online sem expor o Access Token no navegador.

## O que foi incluído

- `delivery_ORIGINAL.html`: cópia exata do arquivo que você enviou, sem alterações.
- `delivery.html`: versão completa ajustada.
- `index.html`: cópia da versão ajustada para usar como index, se esse for o nome da sua página pública.
- `sql/01_MERCADOPAGO_COMPLETO.sql`: cria campos e tabelas de pagamento sem apagar os dados existentes.
- `sql/02_CONFIGURAR_CREDENCIAL_LOJA.sql`: grava/atualiza o Access Token e Webhook Secret de forma privada no Supabase.
- `sql/03_DIAGNOSTICO.sql`: consulta rápida para conferir pedidos e pagamentos.
- `supabase/functions/mp-create-payment`: cria pedido + PIX ou Checkout Pro.
- `supabase/functions/mp-payment-status`: consulta e sincroniza o status.
- `supabase/functions/mp-webhook`: recebe confirmação do Mercado Pago e atualiza o pedido.
- `supabase/functions/_shared`: código compartilhado, CORS, assinatura e API Mercado Pago.
- `supabase/config.toml`: funções públicas necessárias ao checkout do cliente.
- `DEPLOY_SUPABASE.sh`: comandos de deploy prontos para Linux/macOS/terminal do VS Code.

## Fluxo final

### PIX comum
Continua exatamente como já existia no seu delivery. É a chave PIX configurada no painel e não usa a API.

### Online > PIX online
1. Cliente finaliza o carrinho.
2. O HTML envia IDs/quantidades para a Edge Function.
3. O servidor recalcula os preços diretamente do Supabase para impedir alteração de valor pelo navegador.
4. O pedido é criado em `delivery_orders` e os itens em `delivery_order_items`.
5. A Edge Function usa o Access Token privado da loja.
6. Mercado Pago cria o pagamento PIX.
7. O QR Code + PIX Copia e Cola aparecem na própria tela.
8. A página consulta o status a cada 4 segundos.
9. O webhook também confirma o pagamento no banco.
10. Quando aprovado, `payment_status = approved` e `payment_paid_at` é preenchido.

### Online > Checkout Mercado Pago
1. O pedido é criado no Supabase.
2. A Edge Function cria uma preferência de Checkout Pro.
3. O cliente é redirecionado para o Mercado Pago.
4. Ao voltar, a página consulta o pagamento e mostra o resultado.
5. O webhook confirma o status mesmo se o cliente fechar a página.

## 1. Banco de dados

No Supabase > SQL Editor, execute primeiro:

`sql/01_MERCADOPAGO_COMPLETO.sql`

Ele usa `ADD COLUMN IF NOT EXISTS` e `CREATE TABLE IF NOT EXISTS`; não há DROP de tabelas de pedidos e nenhuma rotina apaga pedidos antigos.

## 2. Colocar a credencial da loja no cofre privado

Abra:

`sql/02_CONFIGURAR_CREDENCIAL_LOJA.sql`

Substitua:

- `SEU_DELIVERY_ID`: ID real de `delivery_profiles.id`.
- `APP_USR-SEU_ACCESS_TOKEN`: Access Token de produção da conta Mercado Pago da loja.
- `SUA_WEBHOOK_SECRET`: assinatura secreta exibida em Mercado Pago > Suas integrações > Webhooks.
- `APP_USR-SUA_PUBLIC_KEY`: opcional neste fluxo, pois Checkout Pro e PIX são criados no servidor.

Depois execute no SQL Editor.

**Nunca coloque Access Token no `delivery.html`, JavaScript público, Vercel frontend ou `delivery_profiles`.**

> Observação importante: o arquivo do painel que originalmente salvou seu token não foi enviado nesta etapa. Por isso este pacote não tenta adivinhar a tabela/coluna antiga. Ele cria um cofre privado padronizado (`delivery_payment_integrations`). Copie o token já configurado uma única vez para esse cofre usando o SQL 02. Quando você enviar o HTML do painel de pagamentos, dá para apontar o botão “Substituir token” diretamente para esse mesmo cofre/API.

## 3. Instalar Supabase CLI

Se ainda não tiver:

```bash
npm install -g supabase
```

Login e vínculo:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

## 4. Deploy das Edge Functions

Dentro da raiz deste pacote:

```bash
supabase functions deploy mp-create-payment --no-verify-jwt
supabase functions deploy mp-payment-status --no-verify-jwt
supabase functions deploy mp-webhook --no-verify-jwt
```

O `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados pelo ambiente das Edge Functions do projeto Supabase. O Service Role fica somente no servidor.

## 5. Configurar domínio público

Recomendado:

```bash
supabase secrets set PUBLIC_SITE_URL=https://SEU-DOMINIO.com
supabase secrets set ALLOWED_ORIGINS=https://SEU-DOMINIO.com
```

Exemplo se sua página estiver em `https://meusite.com/delivery.html?slug=minha-loja`:

```bash
supabase secrets set PUBLIC_SITE_URL=https://meusite.com
supabase secrets set ALLOWED_ORIGINS=https://meusite.com
```

A função preserva o pathname enviado pelo seu `delivery.html`, então o retorno continua na mesma página da loja.

## 6. Publicar o HTML

Substitua o HTML público antigo por `delivery.html` (ou use `index.html` se esse for o nome real da sua rota).

O código mantém:

- carrinho existente;
- storage isolado pelo ID da loja;
- stories;
- banners;
- categorias;
- complementos;
- horários;
- entrega/retirada;
- PIX manual;
- dinheiro;
- cartão;
- fluxo interno/WhatsApp antigo quando a forma selecionada não é `Online`.

Apenas o caminho `Pagamento = Online` é interceptado pela nova integração.

## 7. Configuração do Mercado Pago

Na conta Mercado Pago utilizada pela loja:

- use credenciais de produção quando for receber pagamentos reais;
- copie o Access Token para o SQL 02;
- em Webhooks, copie a assinatura secreta para o SQL 02;
- o endpoint de notificação é enviado automaticamente em cada pagamento/preferência como:

`https://SEU-PROJETO.supabase.co/functions/v1/mp-webhook?delivery_id=ID_DA_LOJA`

A função valida `x-signature` antes de aceitar a confirmação do pagamento.

## 8. Teste recomendado

1. Crie um produto barato de teste.
2. Abra a loja publicada.
3. Adicione ao carrinho.
4. Selecione `Online`.
5. Escolha `PIX online`.
6. Informe nome, WhatsApp, endereço se for entrega, e-mail.
7. Clique `Gerar PIX e pagar`.
8. Confira se aparece QR Code e Copia e Cola.
9. Pague e aguarde a tela mudar para `Pagamento aprovado!`.
10. Rode `sql/03_DIAGNOSTICO.sql` para conferir o banco.
11. Faça outro pedido selecionando `Checkout Mercado Pago` e confira o redirecionamento/retorno.

## 9. Campos adicionados ao pedido

- `customer_email`
- `payment_online_method` (`pix` ou `checkout`)
- `payment_status`
- `payment_status_detail`
- `payment_provider`
- `payment_provider_id`
- `payment_preference_id`
- `payment_paid_at`

O campo antigo `payment_method` continua recebendo `Online`, preservando compatibilidade com sua estrutura atual.

## 10. Segurança aplicada

- Access Token não é enviado ao navegador.
- Tabela de credenciais tem RLS e permissões de `anon`/`authenticated` revogadas.
- Preços são recalculados na Edge Function usando os registros do Supabase.
- Adicionais são validados contra os grupos ligados ao produto.
- Taxa e pedido mínimo são recalculados no servidor.
- PIX usa `X-Idempotency-Key`.
- `external_reference` do Mercado Pago recebe o ID do `delivery_orders`.
- Webhook é validado com HMAC-SHA256 e `x-signature`.
- Antes de sincronizar um pagamento, a API confirma que `external_reference` pertence ao pedido/loja.

## 11. Se aparecer erro

Use os logs:

```bash
supabase functions logs mp-create-payment
supabase functions logs mp-payment-status
supabase functions logs mp-webhook
```

E rode `sql/03_DIAGNOSTICO.sql`.

Erros mais comuns:

- `Mercado Pago não está configurado para esta loja`: SQL 02 não foi executado para o ID correto.
- `Pagamento online não está habilitado`: `delivery_profiles.accepts_online` está falso.
- `Assinatura do webhook inválida`: Webhook Secret não corresponde à aplicação usada pelo Access Token.
- `Um item do carrinho não está mais disponível`: produto foi desativado/esgotado depois de entrar no carrinho.


# CLENA — Pagamento online Mercado Pago

Pacote completo para:

- Checkout Pro com redirecionamento;
- Pix online com QR Code e Pix Copia e Cola;
- recálculo de produtos, variações e entrega no backend;
- consulta automática do status;
- webhook;
- registro das transações;
- Access Token criptografado;
- proteção contra alteração de preço no navegador.

## Arquivos

```text
loja.html
assets/css/public-store.css
assets/js/public-store.js
supabase/sql/mercado-pago-pagamentos-completo.sql
supabase/functions/mercado-pago-config/index.ts
supabase/functions/mercado-pago-checkout/index.ts
supabase/functions/mercado-pago-webhook/index.ts
```

## Instalação

### 1. SQL

Execute:

```text
supabase/sql/mercado-pago-pagamentos-completo.sql
```

O SQL pressupõe que já existam:

```text
stores
store_products
store_product_variations
store_delivery_fees
```

### 2. Chave de criptografia

```bash
supabase secrets set MP_CREDENTIALS_ENCRYPTION_KEY="$(openssl rand -base64 48)"
```

Nunca coloque essa chave no navegador ou no GitHub.

### 3. Deploy das funções

```bash
supabase functions deploy mercado-pago-config
supabase functions deploy mercado-pago-checkout --no-verify-jwt
supabase functions deploy mercado-pago-webhook --no-verify-jwt
```

`mercado-pago-checkout` é pública porque o comprador não precisa estar logado. Ela não confia no preço enviado pelo navegador: consulta os produtos e as taxas no banco e recalcula o pedido.

### 4. URL do webhook

Depois do deploy, use no editor:

```text
https://SEU-PROJETO.supabase.co/functions/v1/mercado-pago-webhook
```

Cadastre a mesma URL no painel do Mercado Pago para eventos de pagamentos.

### 5. Arquivos públicos

Substitua:

```text
loja.html
assets/css/public-store.css
assets/js/public-store.js
```

### 6. Teste

1. Use credenciais de teste.
2. Ative a integração no editor.
3. Cadastre ao menos uma taxa ou retirada.
4. Abra a loja publicada.
5. Adicione produtos.
6. Selecione entrega.
7. Teste `PIX online com QR Code`.
8. Teste `Pagar online pelo Mercado Pago`.

## Segurança

- Access Token somente no backend.
- Token salvo criptografado.
- Total recalculado no servidor.
- Variação validada contra o produto.
- Estoque validado antes da cobrança.
- Taxa validada contra a loja.
- Webhook não aceita o status enviado como verdade: consulta a API do Mercado Pago antes de atualizar.
- O navegador recebe somente QR Code, link e identificadores não secretos.

## Observação sobre Pix

A função usa `POST /v1/payments` com `payment_method_id: "pix"` para retornar:

```text
qr_code
qr_code_base64
ticket_url
```

A loja consulta o status a cada poucos segundos e também recebe atualização pelo webhook.

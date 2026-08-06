# CLENA — Mercado Pago seguro

## Arquivos
- `editor-loja.html`: editor com painel completo do Mercado Pago.
- `assets/js/store-editor.js`: cadastro, leitura segura, teste e desconexão.
- `assets/css/store-editor.css`: estilos responsivos.
- `supabase/sql/mercado-pago-integracao.sql`: tabelas, índices e permissões.
- `supabase/functions/mercado-pago-config/index.ts`: Edge Function que criptografa e usa o Access Token.

## Instalação
1. Execute `supabase/sql/mercado-pago-integracao.sql`.
2. Copie HTML, JS e CSS para os caminhos do projeto.
3. Defina o segredo de criptografia (não reutilize a service role):
   `supabase secrets set MP_CREDENTIALS_ENCRYPTION_KEY="uma-chave-aleatoria-com-mais-de-32-caracteres"`
4. Publique a função:
   `supabase functions deploy mercado-pago-config`
5. Use credenciais de teste primeiro.

## Segurança
O Access Token não é salvo no objeto `stores`, não fica no navegador e não é retornado pela API. A tabela privada guarda apenas AES-GCM ciphertext + IV. A Edge Function valida o usuário e confirma que ele é proprietário da loja.

## Próxima etapa
Para cobrar clientes, crie uma função separada que monte a preferência no servidor, recalcule os itens pelo banco e chame `POST https://api.mercadopago.com/checkout/preferences`. Nunca aceite o total calculado pelo navegador.

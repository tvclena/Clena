# Editor da Loja — pacote corrigido completo

## Arquivos para substituir
- `editor-loja.html`
- `assets/css/store-editor.css`
- `assets/js/store-editor.js`
- `assets/js/store-appearance.js`
- `assets/js/store-media-manager.js`

## SQL
Execute `supabase/store-banners-gallery-verification.sql`. A migração é idempotente, separa `placement` (local do banner) de `position` (ordem) e não redefine lojas já verificadas para falso em execuções futuras.

## Validações aplicadas
- IDs usados pelo gerenciador de banners e galeria presentes no HTML.
- `verificationBadge` presente e com proteção contra elemento ausente.
- JavaScript validado por sintaxe.
- Banners usam `placement` para localização e `position` numérico para ordenação.
- Botão de salvar configurações de mídia conectado ao salvamento geral.

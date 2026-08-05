# Editor da Loja — Aparência V2

Este pacote completo corrige e amplia a personalização visual do Editor da Loja.

## Correções principais

1. A coluna de prévia permanece fixa à direita em telas grandes.
2. Somente a coluna de configurações da esquerda rola.
3. A prévia reage imediatamente, sem precisar salvar.
4. Nome, descrição, WhatsApp, Instagram, cores, fontes, temas, capa, logo, produtos e categorias reais são usados na prévia.
5. Imagem local de logo e banner aparece imediatamente.
6. Vídeo local ou URL externa aparece imediatamente na capa da prévia.
7. Redes sociais possuem campos próprios e ícones reais.
8. Somente redes preenchidas são exibidas.
9. Os links aceitam URL completa ou apenas @usuario.
10. WhatsApp e carrinho flutuantes aparecem conforme a configuração.

## Arquivos para substituir

- editor-loja.html
- assets/css/store-editor.css
- assets/js/store-editor.js
- assets/js/store-appearance.js

## Banco de dados

Se a migração de aparência já foi executada, não é necessário executar novamente.
Caso ainda não tenha executado, use:

- supabase/store-appearance-migration.sql

As redes sociais e demais personalizações ficam em `stores.appearance_settings` no formato JSONB.

## Envio

```powershell
git add .
git commit -m "Melhora previa em tempo real e redes sociais da loja"
git push
```

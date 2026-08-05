# Editor da Loja — Banners, Galeria e Verificação

## Instalação
1. Substitua `editor-loja.html`, `assets/css/store-editor.css` e `assets/js/store-editor.js`.
2. Adicione `assets/js/store-media-manager.js`.
3. Execute `supabase/store-banners-gallery-verification.sql` no Supabase SQL Editor.
4. Não coloque `service_role` no navegador. A coluna `stores.is_verified` deve ser alterada futuramente apenas por um painel administrativo seguro.

## Novos recursos
- CRUD completo de banners com imagem/vídeo, posição, datas, dispositivo, link, botão, altura e enquadramento.
- CRUD completo de galeria com imagem/vídeo, legenda, descrição, link, ordem e enquadramento.
- Configuração global de carrossel e galeria salva em `stores.appearance_settings`.
- Coluna `stores.is_verified boolean not null default false`; todas as lojas existentes são mantidas como `false`.
- RLS: cada proprietário gerencia apenas seus itens; visitantes leem somente itens ativos de lojas publicadas.

## Importante
Este pacote atualiza o editor. A página pública deverá ser atualizada depois para renderizar `store_banners` e `store_gallery_items` nas posições escolhidas.

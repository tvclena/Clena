# Editor de Loja — Aparência completa

Este pacote atualiza somente o módulo **Editor da Loja**. Delivery e Agendamentos permanecem separados.

## Arquivos principais

- `editor-loja.html`: nova aba Aparência.
- `assets/css/store-editor.css`: estilos adicionais do editor e da prévia.
- `assets/js/store-editor.js`: integração com salvamento, imagens e vídeo.
- `assets/js/store-appearance.js`: módulo isolado responsável pelas personalizações.
- `supabase/store-appearance-migration.sql`: migração para quem já possui as tabelas.
- `supabase/store-editor.sql`: instalação nova já atualizada.

## Instalação em projeto existente

1. Copie os quatro arquivos do editor para as mesmas posições do projeto.
2. Execute no SQL Editor do Supabase:

   `supabase/store-appearance-migration.sql`

3. Faça commit e push.

## Configurações salvas

As configurações visuais ficam em `stores.appearance_settings` como JSONB. O tipo de capa fica em `stores.cover_type` e o vídeo enviado em `stores.cover_video_url`.

O JSON contém tema, cores, fontes, alinhamentos, formatos, quantidade de colunas, efeitos, animações, cabeçalho, rodapé e CSS personalizado.

## Segurança

- Não há banco local.
- O vídeo e as imagens são armazenados em `store-media`.
- O proprietário continua protegido pelas políticas RLS existentes.
- O CSS personalizado é apenas armazenado nesta etapa. A página pública deverá higienizar e aplicar esse conteúdo quando for atualizada.

## Próxima etapa

A página pública `loja.html` e o script `public-store.js` precisarão ser atualizados para ler `appearance_settings`, `cover_type` e `cover_video_url` e aplicar todas as opções selecionadas.

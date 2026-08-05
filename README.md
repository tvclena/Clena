# CLENA — Loja Pública Completa

Loja pública que obedece às configurações do Editor da Loja, incluindo temas, cores, fontes, capa, vídeo, produtos, categorias, cabeçalho, rodapé, redes sociais, animações, banners, galeria e selo de verificação.

## Instalação

Substitua `loja.html`, `assets/css/public-store.css` e `assets/js/public-store.js`. Execute `supabase/public-store-access.sql` se as políticas públicas ainda não existirem.

Os caminhos dos assets começam em `/assets`, portanto funcionam em `/loja.html?slug=...` e `/loja/:slug`.

## Recursos

- Banners nas seis posições definidas no editor.
- Carrossel, banner único ou grade.
- Autoplay, setas, indicadores, loop, transições e dispositivos.
- Galeria em grade, mosaico, carrossel, destaque, stories e faixa horizontal.
- Lightbox para fotos e vídeos.
- Links para produto, categoria, WhatsApp ou URL externa.
- Selo de loja verificada quando `stores.is_verified = true`.
- Carrinho e checkout pelo WhatsApp.

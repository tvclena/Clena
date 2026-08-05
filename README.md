# Páginas públicas CLENA

Pacote com três cascas independentes:
- `/loja/slug`
- `/delivery/slug`
- `/agendar/slug`

## Instalação
1. Copie os arquivos para a raiz do projeto.
2. Preserve `assets/js/config.js` e `assets/js/supabase-client.js` caso os seus já estejam funcionando.
3. Execute `supabase/public-access.sql` depois dos SQLs dos editores.
4. Faça commit e push.

## Testes locais
Também funcionam assim:
- `loja.html?slug=minha-loja`
- `delivery.html?slug=meu-delivery`
- `agendar.html?slug=meu-negocio`

## Importante
Checkout online real e cobrança automática precisam de API segura na Vercel. Nunca coloque chave secreta de gateway no navegador.

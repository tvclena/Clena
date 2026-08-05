# Editor de Loja — módulo separado

Este pacote adiciona apenas o editor administrativo da loja. Ele usa a mesma autenticação e configuração Supabase da dashboard base.

## Copiar para o projeto

Copie para a raiz do repositório:

- `editor-loja.html`
- `assets/css/store-editor.css`
- `assets/js/store-editor.js`

Os arquivos `assets/js/config.js` e `assets/js/supabase-client.js` já existem na dashboard. Não substitua caso estejam iguais.

## Banco de dados

Execute uma única vez no SQL Editor do Supabase:

`supabase/store-editor.sql`

O SQL cria:

- `stores`
- `store_categories`
- `store_products`
- `store_product_variations`
- bucket público `store-media`
- índices, triggers e políticas RLS

## Abrir o editor

Depois do login, a rota é:

`/editor-loja.html`

Para liberar no menu principal posteriormente, use:

```html
<a href="./editor-loja.html">Editar loja</a>
```

## Recursos já incluídos

- sessão obrigatória pelo Supabase Auth;
- uma loja por usuário;
- identidade da loja;
- logo e banner no Supabase Storage;
- produtos com foto, preço, promoção, SKU, estoque e destaque;
- variações com adicional de preço;
- categorias ordenáveis;
- pesquisa, filtro, seleção e ações em massa;
- personalização de cores e formato grade/lista;
- WhatsApp, pedido mínimo e formas de pagamento;
- endereço público e status de publicação;
- prévia responsiva em formato de celular;
- RLS para separar completamente os dados de cada usuário.

A página pública da loja será criada em outro módulo. O botão de prévia já aponta para `/loja/{slug}` e começará a funcionar quando essa casca pública for adicionada.

# Editor de Delivery • Clena

Módulo independente do Editor de Loja. Usa o mesmo Supabase Auth da dashboard e salva tudo no Supabase.

## Arquivos para copiar

- `editor-delivery.html`
- `assets/css/delivery-editor.css`
- `assets/js/delivery-editor.js`
- `supabase/delivery-editor.sql`

Os arquivos `assets/js/config.js` e `assets/js/supabase-client.js` são os mesmos da dashboard. Não substitua se já estiverem funcionando.

## Instalação

1. Execute `supabase/delivery-editor.sql` no SQL Editor do Supabase.
2. Copie os arquivos para as respectivas pastas do projeto.
3. Abra `/editor-delivery.html` após entrar na dashboard.
4. Libere o botão Delivery no `index.html`.

## Trecho para liberar no menu

```html
<a class="nav-item" href="./editor-delivery.html">
  <i class="ri-motorbike-line" aria-hidden="true"></i>
  <span>Delivery</span>
</a>
```

## Recursos

- Identidade do delivery com logo, capa e cores.
- Cardápio completo, categorias, promoções e disponibilidade.
- Grupos de complementos e opções com acréscimo de valor.
- Entrega e retirada.
- Regiões, bairros, taxas e pedido mínimo.
- Horários por dia e abertura/fechamento manual.
- PIX, cartão, dinheiro e pagamento online.
- Checkout por WhatsApp, interno ou somente cardápio.
- Agendamento e observações de pedido.
- Publicação com slug exclusivo.
- Estrutura de tabelas de pedidos já preparada.
- Storage público com escrita protegida por usuário.
- RLS completa.

A página pública `/delivery/{slug}` será criada como outra casca, separada do editor.

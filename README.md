# Editor de Agendamentos — Clena

Módulo independente para restaurantes, salões, clínicas, consultórios, aulas, locações, espaços e serviços em geral.

## Instalação

1. Copie para o projeto:
   - `editor-agendamentos.html`
   - `assets/css/scheduling-editor.css`
   - `assets/js/scheduling-editor.js`
2. Mantenha os arquivos compartilhados já existentes:
   - `assets/js/config.js`
   - `assets/js/supabase-client.js`
   - `assets/css/base.css`
3. Execute `supabase/scheduling-editor.sql` no SQL Editor do Supabase.
4. Libere o link no `index.html`.

## Link no menu

```html
<a class="nav-item" href="./editor-agendamentos.html">
  <i class="ri-calendar-check-line" aria-hidden="true"></i>
  <span>Agendamentos</span>
</a>
```

## Recursos

- Serviços com duração, valor, capacidade e pagamento próprio.
- Profissionais, mesas, salas, equipamentos, unidades e outros recursos.
- Horários semanais, intervalos, bloqueios e datas especiais.
- Pagamento integral, percentual, sinal fixo ou sem cobrança.
- PIX, cartão online, pagamento local e comprovante.
- Clientes, faltas, bloqueios e histórico.
- Agenda administrativa com status e pagamentos.
- Confirmação automática ou aprovação manual.
- Antecedência mínima, janela máxima, intervalo entre horários e cancelamento.
- Lista de espera, reagendamento, termos, CPF e notificações.
- Página pública com slug, prévia e publicação.

## Observação sobre gateways

A estrutura do banco está preparada para pagamento online, mas a cobrança real por cartão ou PIX dinâmico exige integração posterior com um gateway, usando funções server-side e chaves secretas na Vercel. Nunca coloque chave secreta no JavaScript do navegador.

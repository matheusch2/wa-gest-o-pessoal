# Ferramentas

Duas conferências que o olho não faz. Nenhuma delas entra no site — são só
para rodar antes de subir uma mudança grande de visual.

## Preciso instalar algo?

Só uma vez, e fora do repositório:

    npm install playwright
    npx playwright install chromium

## Auditor de CSS

    node ferramentas/montar-pagina-de-teste.js
    node ferramentas/rodar.js

Ele abre as 38 telas do app — em claro e escuro, em tela de celular e de
computador — e procura **uma regra de fora vencendo a regra do próprio
componente**. É o defeito que já apareceu três vezes aqui: `.campo label`
ganhando de `.escolha-op`, `.meta-sem strong` ganhando de `.fechar-folga`.
A tela não quebra, só fica meio errada, e ninguém percebe olhando.

Saída limpa é `0 colisão(ões)`. Qualquer linha a mais diz o elemento, a
propriedade em disputa e os dois seletores.

**Para confiar nele, quebre-o de propósito**: troque `.escolha .escolha-op`
por `.escolha-op` no style.css e rode de novo. Se não acusar, o auditor é
que está com problema, não o CSS.

## Classes mortas

    node ferramentas/classes-mortas.js

Lista classe que existe no CSS e ninguém usa, e classe que o código escreve
sem ter regra nenhuma. **Tem falso positivo**: classe montada em tempo de
execução (`"aviso" + tipo`, `{classe: "estourou"}`) aparece como não usada.
Confira no `grep` antes de apagar.

## Telas

`telas.json` é a lista de telas auditadas, em pares `["nome", "comando"]`.
**Tela nova pede linha nova aqui** — o que não está na lista não é olhado.

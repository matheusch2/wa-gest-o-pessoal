# Ferramentas

Duas conferências que o olho não faz. Nenhuma delas entra no site — são só
para rodar antes de subir uma mudança grande de visual.

## Preciso instalar algo?

Só uma vez, e fora do repositório:

    npm install playwright
    npx playwright install chromium

Se o seu Chromium estiver em outro lugar, aponte na hora de rodar:

    CHROMIUM=/caminho/do/chromium node ferramentas/rodar.js

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

## Varredura visual

    node ferramentas/montar-pagina-de-teste.js
    node ferramentas/varredura-visual.js

Abre as mesmas telas e procura três estragos que passam despercebidos: a
página passando a rolar pro lado, texto que ficou pequeno demais, e
elemento com texto que perdeu o tamanho. Rode depois de mexer no CSS.

## Ícones e manifesto

    node ferramentas/teste-icones.js

Confere que os ícones existem, têm o tamanho declarado, e que **nenhum
deles é webp**. O iPhone ignora webp no ícone de tela inicial sem dar erro
— sai um quadrado branco e ninguém descobre por quê.

## Telas de abertura

    node ferramentas/gerar-aberturas.js

Redesenha as telas de abertura do iPhone e do iPad a partir de
`assets/simbolo-wa.svg`. Rode sempre que mexer no símbolo.

O Android monta essa tela sozinho, com a cor e o ícone do `manifest.json`.
O Safari **exige uma imagem pronta no tamanho exato de cada aparelho** — e,
não achando a do aparelho em questão, abre em branco sem avisar nada. Por
isso são 15 arquivos, e por isso o `teste-icones.js` confere um por um.

Aparelho novo no mercado: mais uma linha na lista do gerador, roda, e mais
um `<link rel="apple-touch-startup-image">` no `index.html`. O teste reprova
se sobrar imagem sem link, ou link sem imagem.

## Classes mortas

    node ferramentas/classes-mortas.js

Lista classe que existe no CSS e ninguém usa, e classe que o código escreve
sem ter regra nenhuma. **Tem falso positivo**: classe montada em tempo de
execução (`"aviso" + tipo`, `{classe: "estourou"}`) aparece como não usada.
Confira no `grep` antes de apagar.

## Telas

`telas.json` é a lista de telas auditadas, em pares `["nome", "comando"]`.
**Tela nova pede linha nova aqui** — o que não está na lista não é olhado.

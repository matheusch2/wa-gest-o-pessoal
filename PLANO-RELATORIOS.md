# Relatórios e projeções — o plano

Esta tela nasce por partes. Cada parte aqui embaixo é um item fechado:
dá pra construir, ver funcionando e usar, sem depender da seguinte. A
ordem é a de valor, não a de dificuldade.

**Nada nesta lista precisa de IA.** Tudo sai de conta em cima do que o
app já guarda: `lancamentos`, `contas`, `cartoes`, `comprasCartao`,
`pagamentosFatura`, `metas`, `fechamentos`, `entradasFixas`. Conta é
sempre a mesma; IA às vezes inventa. A IA entra no fim, e só pra
comentar a conta que o app já fez.

---

## A regra que vale pra tela inteira

Dois números que não fecham na mesma tela é o pior defeito de um app de
dinheiro — já aconteceu três vezes aqui, e três vezes doeu. Então:

- **O Resumo é o extrato.** Ele responde "o que saiu da conta".
- **O Relatório é o comportamento.** Ele responde "o que eu gastei" —
  e compra no cartão é gasto no mês da compra, mesmo sem ter tocado a
  conta ainda. É o mesmo critério das Metas, chamando a mesma função
  (`_gastoDoMesPorCategoria`).
- **Quando os dois diferem, o Relatório MOSTRA a diferença** em vez de
  escondê-la. O saldo trazido do mês anterior não é renda nova, e o
  relatório diz isso com o valor na frente: "não contamos R$ 257,00 de
  saldo trazido de agosto".

Rótulo diferente pra conta diferente: "Entrou / Gastou" no relatório,
"Entradas / Saídas" no Resumo.

---

## 1. O retrato do mês ✅ *(feito — ganhou rosca)*

O que a pessoa mais vai abrir.

- Quanto **entrou** e quanto **gastou**, e quanto isso é em % — "de
  cada R$ 100 que entraram, você gastou R$ 78".
- **Para onde foi o dinheiro**: todas as categorias, da maior pra
  menor, com barra, valor e percentual. Não só as 6 primeiras — o
  Resumo já faz o top 6 em rosca; aqui é a lista inteira.
- A nota que explica a conta, com a diferença pro Resumo à mostra.

## 2. Frases de alerta ✅ *(feito)*

Conta pura, texto pronto. É o "conselho financeiro" sem IA nenhuma, e
nunca erra:

- "Você estourou a meta de Mercado em **3 dos últimos 4 meses**."
- "Seus gastos obrigatórios são **78%** do que entra."
- "Suas parcelas já comprometem **R$ 800/mês** até março."
- "Este mês você gastou **R$ 340 a mais** que sua média."

Cada frase é uma função que devolve texto ou `null`. Só aparece a que
tem o que dizer — lista que mostra sempre as mesmas seis linhas vira
paisagem, e paisagem ninguém lê.

Saíram seis: a meta que vive estourando, o mês contra a sua média, o
peso das contas e faturas sobre a renda, as parcelas lá na frente, a
categoria que subiu, e como os últimos meses vêm terminando. Todas
olham o mês que está na tela, e o passado a partir dele.

## 3. A linha do tempo ✅ *(feito)*

O Resumo só enxerga um mês. Aqui é o lugar de olhar 6 ou 12.

- **Saldo mês a mês** — uma barra por mês, verde quando sobrou,
  vermelha quando faltou. `fechamentos` já guarda isso.
- **Uma categoria ao longo do tempo** — "Mercado nos últimos 6 meses:
  820, 910, 1.100, 890, 1.240, 1.050". É aqui que a pessoa descobre
  que o gasto subiu sem perceber.
- **Média real da categoria**, mais honesta que a meta chutada. Serve
  até pra sugerir a meta: "sua média de Mercado é R$ 1.000; sua meta
  é 800".

## 4. Projeção ✅ *(feito)*

O "e projeções" do nome. É forte porque **o futuro já está cadastrado**
— não é adivinhação:

- **Quanto já está comprometido** dos próximos meses: parcelas de
  cartão + carnês + contas fixas. "Até março/2027 você já deve
  R$ 14.200; o mês mais pesado é novembro, R$ 2.100."
- **Quando a parcela acaba** — "a moto sai da sua conta em nov/2028;
  aí sobram R$ 600 por mês".
- **Sobra prevista do mês que vem**: entradas fixas − contas fixas −
  parcelas conhecidas.

## 5. A camada de IA

Por último, e por cima de tudo que já existe.

- Edge Function no Supabase. **A chave da IA é segredo do servidor** e
  nunca entra no `index.html` — ela ignoraria qualquer proteção.
- Manda o **resumo já calculado**, não o extrato inteiro: menos dado
  pessoal saindo daqui, resposta mais barata e mais certeira.
- A IA **não faz conta**. Ela comenta a conta que o app fez.
- Se ela estiver fora do ar, o relatório continua inteiro. O texto da
  IA é o extra, nunca o conteúdo.

---

## Ideias do dono do app

*(espaço pra lista do Matheus — o que vier daqui ganha dos itens acima,
porque quem usa o app todo dia é ele.)*

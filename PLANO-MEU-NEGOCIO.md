# Meu negócio

O negócio de quem usa o app, dentro das finanças pessoais dele. Começou
com o WA Aqua e foi construído genérico desde a primeira linha, porque a
ideia é vender isso pra qualquer empreendedor pequeno.

## A regra que sustenta tudo

**Faturamento e custo ficam dentro do negócio. Só a retirada atravessa.**

Quem fatura R$ 20.000 e tem R$ 14.000 de custo não ganhou R$ 20.000 —
ganhou o que tirou. Se o faturamento virasse lançamento pessoal, a sobra
do Resumo ficaria inflada por dinheiro que não é de gastar, e os
Relatórios diriam que a pessoa ganhou o que a empresa faturou.

A retirada é o contrário, e por isso ela **não precisa de exceção
nenhuma**: ela É renda pessoal, e conta no Resumo e nos Relatórios como
qualquer outra entrada. É a única porta entre os dois bolsos, e ela é
estreita de propósito.

> Diferente do resgate de reserva, que é dinheiro que já era seu voltando
> e por isso é descontado do relatório, aqui o dinheiro é novo.

## O que a tela é, e o que ela não é

**Não é um sistema de gestão do negócio.** Viveiro, agendamento de
horário, controle de estoque, nota fiscal — nada disso entra. Isso é
operação, muda de ramo pra ramo, e um app que tentasse abraçar tudo
acabaria servindo pra ninguém. Operação é outro produto (o WA Aqua
Gestão é um deles).

**É a interface do negócio com o dinheiro.** Quatro números, e os quatro
são os mesmos pro barbeiro, pro padeiro, pro entregador de água e pro
produtor de camarão:

| | |
|---|---|
| **Entrou** | o que o negócio recebeu |
| **Custou** | o que ele gastou pra receber |
| **Sobrou** | a diferença — o lucro do mês |
| **Retirei** | o que saiu dele pra conta pessoal |

E a conta que fecha os quatro, escrita na tela: *"dos R$ 3.820 que o
negócio deu, você levou R$ 2.500 — ficaram R$ 1.320 no negócio."* Sem
essa frase, "Sobrou R$ 3.820" e "Retirei R$ 2.500" na mesma tela fazem
qualquer um perguntar se tem três ou um mil lá dentro.

## Por que isso escala sem código por cliente

O que muda de ramo pra ramo é **palavra e categoria**, nunca a conta.
Tudo isso mora em `TIPOS_DE_NEGOCIO`, no topo do `js/negocio.js`:

```js
servico:  { nome, unidade: "serviço", faturamento: [...], custo: [...] }
comercio: { nome, unidade: "venda",   faturamento: [...], custo: [...] }
```

Cliente de um ramo que ainda não existe = **mais uma entrada nesse
objeto**. Não é código novo, é uma linha de dado.

Os ramos de hoje: prestação de serviço, comércio e revenda, alimentação,
entrega e transporte, produção, beleza e cuidados, outro.

A `unidade` é opcional e é o que destrava o ticket médio. Sem ela o
negócio funciona igual — só não dá pra dizer quanto rendeu cada venda.

## O que está pronto

- [x] `negocios` e `movimentos_negocio` no banco, com RLS
- [x] Os quatro números do mês, com a conta fechada por escrito
- [x] Faturamento, custo e retirada — só a retirada cria lançamento
- [x] Caixa acumulado do negócio (todos os meses, não o da tela)
- [x] Ticket médio por unidade
- [x] Custo por categoria
- [x] Sete ramos, com categorias próprias
- [x] Mês no vermelho com a cor e a palavra trocadas
- [x] Tabela que falta não derruba o app

## O que vem depois

1. **Mais de um negócio por pessoa.** Hoje a tela usa o primeiro
   (`_negocioAtual()`). A tabela já aguenta vários — falta o seletor e
   decidir se o Resumo soma as retiradas de todos.

2. **Contas a receber do negócio.** Quem vende fiado ou com prazo precisa
   saber o que está pra entrar. É o espelho das Contas a pagar, do lado
   do negócio.

3. **Comparar meses.** O negócio deu mais ou menos que no mês passado? A
   linha do tempo dos Relatórios já sabe fazer isso; falta apontá-la pros
   movimentos do negócio.

4. **Custo fixo recorrente.** Aluguel do ponto, mensalidade de sistema.
   Hoje é relançado todo mês à mão.

5. **A ponte com o WA Aqua Gestão.** O sistema de operação escreveria o
   faturamento e o custo aqui pela mesma porta estreita, em vez de ter o
   próprio controle de boletos — que hoje é a mesma coisa implementada
   duas vezes, em dois apps, que nunca vão concordar.

## Ideias do dono do app

<!-- espaço pro que for aparecendo no uso -->

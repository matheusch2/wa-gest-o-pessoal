/* BALANÇO: O NÚMERO QUE O APP NÃO TINHA.
 *
 * Até esta tela, "saldo" no WA Finanças queria dizer entradas menos saídas
 * DAQUELE mês, começando do zero. Quem tinha R$ 3.000 na conta no dia em
 * que instalou o app nunca viu esses R$ 3.000, e quem fechou outubro com
 * R$ 800 viu novembro começar vazio.
 *
 * A pessoa diz quanto tem. Esse número vira a base, e a tela faz UMA
 * conta: tenho + vou receber − vou pagar.
 *
 * ─── O QUE SAIU DAQUI, E POR QUÊ ────────────────────────────────────────
 * A primeira versão comparava o saldo informado com o que o app calculara
 * e anunciava a diferença. Isso chegou na mão do dono do app como "Faltou
 * dinheiro na conta: R$ 4.180,83" na primeira vez que ele usou — um
 * número que não existia, porque sem base anterior o app somava todos os
 * lançamentos desde sempre. Saiu inteiro. As conferências que travavam
 * aquele comportamento saíram junto; ficaram as que travam o que a tela
 * faz hoje, e mais algumas novas pra garantir que o que saiu não volta.
 *
 * Os defeitos que ainda cabem aqui:
 *
 *   - limite de data trocado   → o lançamento do dia do saldo conta duas
 *                                vezes, e o "você tem" mente
 *   - base errada              → soma desde sempre em vez de partir do
 *                                último saldo informado
 *   - saldo sem base           → R$ 0,00 apresentado como verdade
 *   - horizonte diferente      → Balanço e Resumo discordando sobre
 *                                quanto ainda vai sair do mês
 *   - gravar com insert        → saldo digitado errado sem conserto, já
 *                                que não existe mais lista nem excluir
 */

const { suite } = require("./_apoio");

/* Datas relativas a hoje, porque a tela toda é sobre hoje. Cenário com
   data fixa passa a falhar sozinho quando aquele mês vira passado — e o
   app trata mês passado de outro jeito de propósito. */
const HOJE = new Date();
const D = (n) => {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
                         + "-" + String(d.getDate()).padStart(2, "0");
};
const HJ = D(0);
const dataBRDe = (ymd) => { const [a, m, d] = ymd.split("-"); return `${d}/${m}/${a}`; };

const BASE = `
  lancamentos = []; contas = []; cartoes = []; comprasCartao = [];
  pagamentosFatura = []; metas = []; fechamentos = []; entradasFixas = [];
  reservas = []; movimentosReserva = []; conferencias = [];
  tabelasFaltando = [];
  mesAtual = mesDe(_hojeLocal());
`;

/* O CENÁRIO DOS LIMITES DE DATA.
 *
 * Saldo de R$ 2.000 informado em D(-30). Depois dele: +500 e −300 e +400,
 * então hoje são R$ 2.600.
 *
 * O −1.000 EM D(-30) está aqui de propósito: é o dia do saldo informado,
 * e ele não pode contar — o saldo que a pessoa copiou do banco naquele
 * dia já contém ele. Contando, o "você tem" cai pra R$ 1.600.
 */
const COM_SALDO = `
  lancamentos = [
    { id:"x1", tipo:"saida",   valor:1000, data:"${D(-30)}", categoria:"Casa",    descricao:"No dia do saldo" },
    { id:"x2", tipo:"entrada", valor:500,  data:"${D(-20)}", categoria:"Salário", descricao:"Depois" },
    { id:"x3", tipo:"saida",   valor:300,  data:"${D(-10)}", categoria:"Mercado", descricao:"Depois" },
    { id:"x4", tipo:"entrada", valor:400,  data:"${D(-3)}",  categoria:"Vendas",  descricao:"Depois" },
  ];
  conferencias = [{ id:"cfa", data:"${D(-30)}", saldo_informado:2000 }];
`;

module.exports = () => suite("Balanço: quanto você tem", async ({ p, ok, abrir, texto, valor, chamadas, falharProxima }) => {

  /* ─── O BOTÃO NO MENU ────────────────────────────────────────────── */
  await abrir(BASE + "; voltarInicio();");
  const nomes = (await p.locator("#menu .menu-botao").allTextContents()).map(t => t.trim());
  ok("há um 'Balanço' no menu", nomes.includes("Balanço"));
  ok("e ele fica ao lado do Resumo, que é a outra metade da pergunta",
    nomes.indexOf("Balanço") === nomes.indexOf("Resumo do mês") + 1);

  /* O MENU FECHA EM PARES. São dez botões num grid de duas colunas: cinco
     linhas cheias, sem nenhum meio botão com meio vazio do lado, que lê
     como falha de carregamento. Era isso que o "Meu negócio" resolvia
     ocupando a linha inteira quando eram onze; saindo ele, a conta volta
     a fechar sozinha. */
  ok("o menu tem dez botões", nomes.length === 10);
  ok("nenhum precisa ocupar a linha inteira",
    (await p.locator("#menu .menu-botao-largo").count()) === 0);
  ok("o Resumo é o primeiro", nomes[0] === "Resumo do mês");


  /* ─── A TELA É CURTA, E ISSO É O RECURSO ─────────────────────────────
     Ela já teve bloco de diferença, nota explicando a primeira vez e
     lista de conferências. Tudo isso exigia uma aula pra ser lido. Hoje
     são duas coisas: o número e a conta. */
  await abrir(BASE + COM_SALDO + "; abrirBalanco();");
  const tela = await texto("#area");
  ok("a tela não fala em faltar dinheiro na conta", !tela.includes("Faltou dinheiro"));
  ok("nem em sobrar dinheiro na conta", !tela.includes("Sobrou dinheiro"));
  ok("nem cita o que o app esperava", !tela.includes("o app esperava"));
  ok("nem fala em ponto de partida", !tela.includes("ponto de partida"));
  ok("nem em conferência", !tela.toLowerCase().includes("conferência"));
  ok("não sobrou lista de saldos antigos", (await p.locator(".lista .item").count()) === 0);
  ok("são dois blocos: o número e a conta",
    (await p.locator(".contas-total").count()) === 1 &&
    (await p.locator(".balanco-conta").count()) === 1);


  /* ─── QUANTO VOCÊ TEM HOJE ──────────────────────────────────────────
     O limite de data é o lugar mais fácil de errar e o mais caro: o dia
     do saldo informado é EXCLUSIVO, porque o número copiado do banco
     naquele dia já contém o que aconteceu nele. */
  const hoje = await p.evaluate(() => saldoDeHoje());
  ok("hoje você tem R$ 2.600,00 — o saldo mais o que se moveu depois",
    hoje.valor === 2600);
  ok("o lançamento do DIA DO SALDO não conta de novo", hoje.valor !== 1600);
  ok("e o app sabe de quando é a base", hoje.desde === D(-30));
  ok("sem ser de hoje", hoje.dehoje === false);

  const grande = await texto(".contas-total");
  ok("o número grande da tela é o que você TEM", grande.includes("2.600,00"));
  ok("e ele se apresenta como saldo em conta, não como saldo do mês",
    grande.includes("Você tem na conta"));
  ok("dizendo de quando é a base", grande.includes("mais o que se moveu"));

  await abrir(BASE + `
    conferencias = [{ id:"c1", data:"${HJ}", saldo_informado:3021 }];
    abrirBalanco();`);
  ok("colocado hoje, a tela diz que é de hoje",
    (await texto(".contas-total")).includes("Atualizado hoje"));


  /* ─── SEM SALDO INFORMADO O APP NÃO SABE ─────────────────────────────
     E dizer que não sabe é melhor do que dar um número que começou do
     zero. Era exatamente o que o app fazia antes desta tela. */
  await abrir(BASE + `
    lancamentos = [{ id:"s", tipo:"saida", valor:120, data:"${D(-2)}",
                     categoria:"Mercado", descricao:"Feira" }];
    abrirBalanco();`);
  ok("sem base, o app não devolve saldo", (await p.evaluate(() => saldoDeHoje())) === null);
  const semBase = await texto(".contas-total");
  ok("a tela PERGUNTA em vez de afirmar", semBase.includes("Quanto você tem na conta?"));
  ok("e não mostra R$ 0,00 como se fosse verdade", !semBase.includes("R$ 0,00"));
  ok("explicando que falta dizer de quanto partiu", semBase.includes("não sabe de quanto partiu"));
  ok("sem projetar nada por cima de um saldo que não existe",
    (await p.locator(".balanco-conta").count()) === 0);
  ok("mas com o botão em destaque", (await texto(".botao")).includes("Colocar o saldo"));


  /* A BASE É O SALDO MAIS RECENTE, não o primeiro que a pessoa colocou.
     Quem usa o app há meses tem vários, e partir do mais antigo faria o
     app refazer, a cada abertura, uma soma que já foi corrigida. */
  await abrir(BASE + `
    lancamentos = [
      { id:"a", tipo:"saida",   valor:200, data:"${D(-10)}", categoria:"Casa",   descricao:"Entre os dois" },
      { id:"b", tipo:"entrada", valor:100, data:"${D(-2)}",  categoria:"Vendas", descricao:"Depois" },
    ];
    conferencias = [{ id:"c1", data:"${D(-20)}", saldo_informado:1000 },
                    { id:"c2", data:"${D(-5)}",  saldo_informado:1500 }];
    abrirBalanco();`);
  ok("com vários saldos, vale o mais recente: 1500 + 100 = 1600",
    (await p.evaluate(() => saldoDeHoje().valor)) === 1600);
  ok("e não o primeiro, que daria 900",
    (await p.evaluate(() => saldoDeHoje().valor)) !== 900);
  ok("a tela mostra de quando é a base que ela usou",
    (await texto(".contas-total")).includes(dataBRDe(D(-5))));


  /* ─── SALDO COM DATA NO FUTURO NÃO É BASE DE NADA ────────────────────
     O app não deixa gravar um (a gravação usa sempre hoje), mas se um
     aparecer — vindo de outro aparelho, de outro fuso — o "você tem"
     continua saindo do último saldo que JÁ ACONTECEU. */
  await abrir(BASE + `
    conferencias = [{ id:"c1", data:"${D(-5)}",  saldo_informado:900 },
                    { id:"c2", data:"${D(+5)}",  saldo_informado:5000 }];
    abrirBalanco();`);
  ok("o saldo de hoje ignora o que está datado no futuro",
    (await p.evaluate(() => saldoDeHoje().valor)) === 900);
  ok("e a tela mostra o número que já aconteceu",
    (await texto(".contas-total")).includes("900,00"));


  /* ─── TENHO + VOU RECEBER − TENHO A PAGAR ────────────────────────────
     A conta que ele pediu, e a única coisa que esta tela faz além de
     mostrar o saldo. O horizonte é o MÊS CORRENTE, o mesmo do Resumo:
     dois horizontes diferentes fariam as duas telas discordarem sobre
     quanto sobra, e aí não serve nenhuma das duas. */
  const MES = `
    conferencias = [{ id:"c1", data:"${HJ}", saldo_informado:1000 }];
    entradasFixas = [{ id:"ef1", nome:"Salário", valor:2000, dia:28, categoria:"Salário" }];
    contas = [{ id:"k1", nome:"Aluguel", valor:1400,
                vencimento:mesDe(_hojeLocal()) + "-27", pago:false, categoria:"Casa" }];
  `;
  await abrir(BASE + MES + "; abrirBalanco();");
  const conta = await p.locator(".balanco-conta > div").allTextContents();
  ok("a conta tem quatro linhas: tenho, recebo, pago, sobra", conta.length === 4);
  ok("a primeira é o que você tem", conta[0].includes("Você tem") && conta[0].includes("1.000,00"));
  ok("a segunda é o que ainda vai receber", conta[1].includes("2.000,00"));
  ok("a terceira é o que ainda vai pagar", conta[2].includes("1.400,00"));
  ok("e a última fecha a conta: 1000 + 2000 − 1400 = 1600",
    conta[3].includes("Sobra") && conta[3].includes("1.600,00"));

  /* OS NÚMEROS SÃO OS DO APP, não cópias. Se o Balanço recalculasse "o
     que ainda vai sair" por conta própria, ele e o Resumo dariam
     respostas diferentes pro mesmo mês — o defeito que este projeto mais
     persegue. */
  const doApp = await p.evaluate(() => {
    const m = mesDe(_hojeLocal());
    return { receber: aReceberDoMes(m).total, pagar: aindaVaiSairDoMes(m).total };
  });
  ok("o 'vou receber' vem do mesmo lugar que o do Resumo", doApp.receber === 2000);
  ok("o 'vou pagar' também", doApp.pagar === 1400);

  /* E O HORIZONTE É HOJE, NÃO O MÊS QUE A PESSOA ESTAVA OLHANDO. Quem
     veio do Resumo navegando até março não quer que o Balanço responda
     sobre março: "quanto eu tenho" é sempre sobre agora. */
  await abrir(BASE + MES + `; mesAtual = _somaMes(mesDe(_hojeLocal()), 4); abrirBalanco();`);
  const outroMes = await p.locator(".balanco-conta > div").allTextContents();
  ok("navegar pra outro mês no Resumo não muda o Balanço",
    outroMes[3].includes("1.600,00"));


  /* ─── QUANDO NÃO DÁ ─────────────────────────────────────────────────── */
  await abrir(BASE + `
    conferencias = [{ id:"c1", data:"${HJ}", saldo_informado:200 }];
    contas = [{ id:"k1", nome:"Aluguel", valor:1400,
                vencimento:mesDe(_hojeLocal()) + "-27", pago:false, categoria:"Casa" }];
    abrirBalanco();`);
  const aperto = await p.locator(".balanco-conta > div").allTextContents();
  ok("faltando dinheiro, a última linha diz FALTA", aperto[3].includes("Falta"));
  ok("com o valor sem sinal de menos grudado", aperto[3].includes("1.200,00"));
  ok("e veste vermelho", (await p.locator(".balanco-conta-fim.ruim").count()) === 1);

  /* E NÃO HÁ FRASE EMBAIXO repetindo o resultado em palavras. O número
     em corpo 21 já disse; a legenda só empurrava a conta pra cima. */
  ok("não há parágrafo repetindo o resultado",
    (await p.locator(".rel-rodape").count()) === 0);
  const curta = await texto("#area");
  ok("nem em palavras soltas", !curta.includes("pra cobrir o que ainda vence"));
  ok("nem na versão de quando sobra", !curta.includes("se nada novo aparecer"));


  /* ─── COLOCAR O SALDO: UM CAMPO E UM BOTÃO ───────────────────────────
     O formulário já teve campo de data, prévia da diferença enquanto se
     digitava e um parágrafo explicando o que ia acontecer. Hoje tem o
     campo e o botão, porque a pessoa está com o app do banco aberto na
     outra mão e o saldo é o de agora. */
  await abrir(BASE + COM_SALDO + "; abrirAtualizarSaldo();");
  ok("o campo do saldo começa VAZIO, de propósito",
    (await p.inputValue("#cf-saldo")) === "");
  ok("não há campo de data", (await p.locator("#cf-data").count()) === 0);
  const dica = await texto(".cartao-dica");
  ok("a dica manda abrir o banco", dica.includes("app do seu banco"));
  ok("e não promete veredicto nenhum",
    !dica.includes("diferença") && !dica.includes("espera"));
  ok("o título diz que é atualização, já que já existe um saldo",
    (await texto("h2")).includes("Atualizar o saldo"));

  await abrir(BASE + "; abrirAtualizarSaldo();");
  ok("sem saldo nenhum ainda, o título é colocar",
    (await texto("h2")).includes("Colocar o saldo"));


  /* ─── GRAVAR ─────────────────────────────────────────────────────── */
  await abrir(BASE + COM_SALDO + "; abrirAtualizarSaldo();");
  await p.fill("#cf-saldo", "2.480,00");
  await p.click(".botao");
  const g = await chamadas();
  ok("salvar grava UMA linha", g.length === 1 && g[0].tabela === "conferencias");
  ok("com o saldo lido do campo, milhar e tudo", g[0].dados.saldo_informado === 2480);
  ok("sempre com a data de hoje", g[0].dados.data === HJ);
  ok("e o dono", g[0].dados.user_id === "u1");

  /* UPSERT, NÃO INSERT, e isto é o que torna a tela sem lista possível:
     não há mais onde apagar um saldo digitado errado, então digitar de
     novo no mesmo dia TEM que corrigir em vez de dar erro de duplicado.
     Com insert, o segundo toque batia no índice único e a pessoa ficava
     presa com o número errado. */
  ok("como upsert, não insert", g[0].op === "upsert");
  ok("conflitando por dono e dia", g[0].conflito.onConflict === "user_id,data");

  ok("e o aviso é só a confirmação, sem veredicto",
    (await texto("#avisos")).includes("Saldo atualizado"));

  /* E o segundo saldo do mesmo dia SUBSTITUI o primeiro na memória do
     app, igual o banco faz. Sem isto a tela voltaria mostrando os dois,
     e o "você tem" sairia do que foi corrigido. */
  await abrir(BASE + `
    conferencias = [{ id:"c1", data:"${HJ}", saldo_informado:999 }];
    abrirAtualizarSaldo();`);
  await p.fill("#cf-saldo", "3021");
  await p.click(".botao");
  ok("um saldo por dia continua valendo do lado de cá",
    (await p.evaluate(() => conferencias.length)) === 1);
  ok("e é o novo que vale",
    (await p.evaluate(() => saldoDeHoje().valor)) === 3021);

  /* Saldo ZERO é saldo. Conta zerada existe, e recusar o zero obrigaria a
     pessoa a mentir ou a não colocar. */
  await abrir(BASE + "; abrirAtualizarSaldo();");
  await p.fill("#cf-saldo", "0");
  await p.click(".botao");
  const zero = await chamadas();
  ok("saldo zero é aceito", zero.length === 1 && zero[0].dados.saldo_informado === 0);

  await abrir(BASE + "; abrirAtualizarSaldo();");
  await p.click(".botao");
  ok("campo vazio não grava nada", (await chamadas()).length === 0);
  ok("e diz o que falta", (await texto("#avisos")).includes("saldo"));

  /* SALDO NEGATIVO tem duas trancas, e a primeira é o teclado: o
     formatador de dinheiro do app já come o sinal de menos enquanto se
     digita. A segunda é a conferência no salvar, pra quando o valor
     chegar por outro caminho. */
  await abrir(BASE + "; abrirAtualizarSaldo();");
  await p.fill("#cf-saldo", "-300");
  ok("o campo de dinheiro não deixa nem digitar o menos",
    (await p.inputValue("#cf-saldo")) === "300");

  await abrir(BASE + `; abrirAtualizarSaldo();
    document.getElementById("cf-saldo").value = "-300";`);
  await p.click(".botao");
  ok("e, se um negativo chegar de outro jeito, não grava",
    (await chamadas()).length === 0);
  ok("explicando que cheque especial é dívida, não saldo",
    (await texto("#avisos")).includes("dívida"));

  /* Erro do banco não pode passar por sucesso: a tela tem que continuar
     no formulário, com o número ainda na mão da pessoa. */
  await abrir(BASE + "; abrirAtualizarSaldo();");
  await falharProxima("XX000", "indisponível");
  await p.fill("#cf-saldo", "1500");
  await p.click(".botao");
  ok("falhando a gravação, a tela avisa", (await texto("#avisos")).includes("Erro ao salvar"));
  ok("e não volta como se tivesse dado certo",
    (await p.locator("#cf-saldo").count()) === 1);


  /* ─── A TABELA QUE FALTA NÃO DERRUBA O APP ───────────────────────────
     Mesma lição das Reservas, com a tabela nova desta vez. Quem não rodou
     o banco.sql vê a tela explicando, não o app parado — e não vê R$ 0,00
     apresentado como o saldo dele. */
  await abrir(BASE + `window.TABELAS_SEM_BANCO = ["conferencias"];`);
  const carregou = await p.evaluate(() => carregarTudo());
  ok("faltando a tabela nova, o app ainda carrega", carregou === true);
  ok("e o app sabe DIZER que ela faltou",
    (await p.evaluate(() => faltaATabela("conferencias"))) === true);

  await p.evaluate(() => abrirBalanco());
  const semTabela = await texto("#area");
  ok("a tela explica que falta rodar o banco.sql",
    semTabela.includes("banco.sql") && semTabela.includes("SQL Editor"));
  ok("e não mostra saldo nenhum", (await p.locator(".contas-total").count()) === 0);
  ok("nem a projeção do mês", (await p.locator(".balanco-conta").count()) === 0);

  await p.evaluate(() => voltarInicio());
  await p.evaluate(() => abrirResumo());
  ok("e o Resumo abre normalmente do lado", (await p.locator(".saldo").count()) === 1);
});

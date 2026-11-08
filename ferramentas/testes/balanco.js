/* BALANÇO: O NÚMERO QUE O APP NÃO TINHA.
 *
 * Até esta tela, "saldo" no WA Finanças queria dizer entradas menos saídas
 * DAQUELE mês, começando do zero. Quem tinha R$ 3.000 na conta no dia em
 * que instalou o app nunca viu esses R$ 3.000, e quem fechou outubro com
 * R$ 800 viu novembro começar vazio.
 *
 * A conferência resolve isso com UM fato guardado — "no dia 8 eu tinha
 * tanto" — e tudo o mais é calculado. Os defeitos que caberiam aqui são
 * todos do mesmo tipo: números que não fecham entre si.
 *
 *   - limite de data trocado      → o lançamento do dia da conferência
 *                                   conta duas vezes, e a diferença mente
 *   - diferença gravada em campo  → ela continua apontando um erro que já
 *                                   foi corrigido
 *   - âncora errada               → soma desde sempre em vez de partir da
 *                                   última conferência
 *   - saldo sem âncora            → R$ 0,00 apresentado como verdade
 *   - horizonte diferente         → Balanço e Resumo discordando sobre
 *                                   quanto ainda vai sair do mês
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

const BASE = `
  lancamentos = []; contas = []; cartoes = []; comprasCartao = [];
  pagamentosFatura = []; metas = []; fechamentos = []; entradasFixas = [];
  reservas = []; movimentosReserva = []; conferencias = [];
  tabelasFaltando = [];
  mesAtual = mesDe(_hojeLocal());
`;

/* O CENÁRIO DOS LIMITES DE DATA.
 *
 * Conferência de R$ 2.000 em D(-30) e de R$ 2.150 em D(-10). Entre as
 * duas, +500 e −300: o app espera R$ 2.200 no dia 10, então a diferença
 * da segunda é de −R$ 50.
 *
 * Os dois lançamentos das pontas estão aqui de propósito:
 *
 *   −1.000 EM D(-30), o dia da PRIMEIRA conferência. Não pode contar: o
 *   saldo informado naquele dia já contém ele. Contando, o esperado cai
 *   pra R$ 1.200.
 *
 *   −300 EM D(-10), o dia da SEGUNDA. Tem que contar: a pessoa informa o
 *   saldo no fim do dia. Sem ele, o esperado sobe pra R$ 2.500.
 *
 * Três resultados diferentes pro mesmo cenário — é isso que faz o teste
 * valer: qualquer troca de < por <= aparece num número.
 */
const PAR = `
  lancamentos = [
    { id:"x1", tipo:"saida",   valor:1000, data:"${D(-30)}", categoria:"Casa",    descricao:"No dia da primeira" },
    { id:"x2", tipo:"entrada", valor:500,  data:"${D(-20)}", categoria:"Salário", descricao:"Entre as duas" },
    { id:"x3", tipo:"saida",   valor:300,  data:"${D(-10)}", categoria:"Mercado", descricao:"No dia da segunda" },
    { id:"x4", tipo:"entrada", valor:400,  data:"${D(-3)}",  categoria:"Vendas",  descricao:"Depois da segunda" },
  ];
  conferencias = [
    { id:"cfa", data:"${D(-30)}", saldo_informado:2000 },
    { id:"cfb", data:"${D(-10)}", saldo_informado:2150 },
  ];
`;

module.exports = () => suite("Balanço: conferir o saldo", async ({ p, ok, abrir, texto, valor, chamadas, falharProxima }) => {

  /* ─── O BOTÃO NO MENU ────────────────────────────────────────────── */
  await abrir(BASE + "; voltarInicio();");
  const nomes = (await p.locator("#menu .menu-botao").allTextContents()).map(t => t.trim());
  ok("há um 'Balanço' no menu", nomes.includes("Balanço"));
  ok("e ele fica ao lado do Resumo, que é a outra metade da pergunta",
    nomes.indexOf("Balanço") === nomes.indexOf("Resumo do mês") + 1);
  ok("nenhum botão fica meio sozinho na última linha",
    (await p.locator("#menu .menu-botao-largo").count()) === 1);


  /* ─── O LIMITE DE DATA ───────────────────────────────────────────────
     O começo é EXCLUSIVO e o fim é INCLUSIVO. É o lugar mais fácil de
     errar nesta tela e o mais caro: errado, a diferença acusa um buraco
     que não existe, e a pessoa vai caçar um lançamento que está lá. */
  await abrir(BASE + PAR);
  const esperadoNaSegunda = await p.evaluate(() => saldoCalculadoEm(conferencias[1].data, "cfb"));
  ok("o esperado na segunda conferência é R$ 2.200,00", esperadoNaSegunda === 2200);
  ok("o lançamento do DIA DA ÂNCORA não conta de novo", esperadoNaSegunda !== 1200);
  ok("o lançamento do DIA DA CONFERÊNCIA conta", esperadoNaSegunda !== 2500);

  const dif = await p.evaluate(() => diferencaDaConferencia(conferencias[1]));
  ok("então a diferença da segunda é de −R$ 50,00", dif.diferenca === -50);
  ok("e ela não se compara consigo mesma", dif.esperado === 2200);

  /* A ÂNCORA É A CONFERÊNCIA ANTERIOR MAIS RECENTE, não a primeira e não
     a soma desde sempre. Sem ela, o esperado seria −800 (os lançamentos
     todos a partir do zero), e a diferença viraria um número absurdo. */
  ok("a conta parte da última conferência, não do zero", dif.esperado !== -800);


  /* ─── QUANTO VOCÊ TEM HOJE ──────────────────────────────────────── */
  await abrir(BASE + PAR + "; abrirBalanco();");
  const hoje = await p.evaluate(() => saldoDeHoje());
  ok("hoje você tem R$ 2.550,00 — a conferência mais o que se moveu",
    hoje.valor === 2550);
  ok("e o app diz de quando é a âncora", hoje.desde === await p.evaluate(() => conferencias[1].data));
  ok("sem ser conferido hoje", hoje.conferido === false);

  const grande = await texto(".contas-total");
  ok("o número grande da tela é o que você TEM", grande.includes("2.550,00"));
  ok("e ele se apresenta como saldo em conta, não como saldo do mês",
    grande.includes("Você tem na conta"));
  ok("dizendo desde quando", grande.includes("Conferido em"));


  /* ─── A DIFERENÇA É O ACHADO ────────────────────────────────────── */
  const furo = await texto(".balanco-furo");
  ok("a tela mostra o buraco de R$ 50,00", furo.includes("50,00"));
  ok("chamando pelo nome do que aconteceu", furo.includes("Faltou dinheiro na conta"));
  ok("e mostra os dois números lado a lado",
    furo.includes("2.150,00") && furo.includes("2.200,00"));
  ok("apontando pro que falta fazer", furo.includes("não foi lançada"));


  /* ─── A DIFERENÇA SOME SOZINHA ───────────────────────────────────────
     É por isso que ela não é gravada. Achado o lançamento esquecido, o
     bloco tem que DESAPARECER — diferença em campo continuaria acusando
     um erro já corrigido, e a pessoa ia procurar pra sempre. */
  await abrir(BASE + PAR + `
    lancamentos.push({ id:"achei", tipo:"saida", valor:50, data:"${D(-11)}",
                       categoria:"Lazer", descricao:"O que faltava" });
    abrirBalanco();`);
  ok("lançado o que faltava, o buraco desaparece da tela",
    (await p.locator(".balanco-furo").count()) === 0);
  ok("e a diferença calculada volta a zero",
    (await p.evaluate(() => diferencaDaConferencia(conferencias[1]).diferenca)) === 0);
  /* E O SALDO DE HOJE NÃO SE MEXE, o que parece errado e não é: o saldo
     informado é um FATO sobre o dia 10, e achar o lançamento que faltava
     não muda o que o banco mostrava naquele dia. O que muda é só a
     EXPECTATIVA do app, que era o que estava errada. Se o número grande
     pulasse aqui, ele estaria contando o mesmo dinheiro duas vezes. */
  ok("mas o saldo de hoje não se mexe — o fato do banco é o mesmo",
    (await p.evaluate(() => saldoDeHoje().valor)) === 2550);

  /* Batendo, a lista diz que bateu em vez de mostrar um zero solto. */
  const linha = await texto("#conf-cfb");
  ok("a linha da conferência diz que bateu certinho", linha.includes("bateu certinho"));
  ok("sem inventar um valor de diferença", !linha.includes("R$ 0,00"));


  /* ─── SOBRAR É O OUTRO LADO DO MESMO ACHADO ─────────────────────── */
  await abrir(BASE + `
    conferencias = [{ id:"c1", data:"${D(-20)}", saldo_informado:1000 },
                    { id:"c2", data:"${D(-5)}",  saldo_informado:1300 }];
    abrirBalanco();`);
  const sobrou = await texto(".balanco-furo");
  ok("sobrando dinheiro, a tela diz que sobrou", sobrou.includes("Sobrou dinheiro na conta"));
  ok("com o valor certo", sobrou.includes("300,00"));
  ok("e aponta pra uma entrada, não pra uma saída", sobrou.includes("entrou alguma coisa"));
  ok("e não veste a cor de alerta",
    (await p.locator(".balanco-furo.sobrando").count()) === 1);


  /* ─── SEM CONFERÊNCIA NENHUMA O APP NÃO SABE ─────────────────────────
     E dizer que não sabe é melhor do que dar um número que começou do
     zero. Era exatamente o que o app fazia antes desta tela. */
  await abrir(BASE + `
    lancamentos = [{ id:"s", tipo:"saida", valor:120, data:"${D(-2)}",
                     categoria:"Mercado", descricao:"Feira" }];
    abrirBalanco();`);
  ok("sem âncora, o app não devolve saldo", (await p.evaluate(() => saldoDeHoje())) === null);
  const semAncora = await texto(".contas-total");
  ok("a tela PERGUNTA em vez de afirmar", semAncora.includes("Quanto você tem na conta?"));
  ok("e não mostra R$ 0,00 como se fosse verdade", !semAncora.includes("R$ 0,00"));
  ok("explicando que falta o ponto de partida", semAncora.includes("ponto de partida"));
  ok("sem projetar nada por cima de um saldo que não existe",
    (await p.locator(".balanco-conta").count()) === 0);
  ok("mas com o botão de conferir em destaque",
    (await texto(".botao")).includes("Conferir o saldo"));


  /* ─── CONFERÊNCIA COM DATA NO FUTURO NÃO ANCORA NADA ────────────────
     Ela existiria na lista e seria ignorada pelo número grande. O app não
     deixa gravar uma (conferido mais abaixo), mas se uma aparecer — vinda
     de outro aparelho, de outro fuso — o saldo de hoje tem que continuar
     saindo da última conferência que JÁ ACONTECEU. */
  await abrir(BASE + `
    conferencias = [{ id:"c1", data:"${D(-5)}",  saldo_informado:900 },
                    { id:"c2", data:"${D(+5)}",  saldo_informado:5000 }];
    abrirBalanco();`);
  ok("o saldo de hoje ignora a conferência do futuro",
    (await p.evaluate(() => saldoDeHoje().valor)) === 900);
  ok("e a tela mostra o número que já aconteceu",
    (await texto(".contas-total")).includes("900,00"));


  /* ─── TENHO + VOU RECEBER − TENHO A PAGAR ────────────────────────────
     O que ele pediu. O horizonte é o MÊS CORRENTE, o mesmo do Resumo:
     dois horizontes diferentes fariam as duas telas discordarem sobre
     quanto sobra, e aí não serve nenhuma das duas. */
  const MES = `
    conferencias = [{ id:"c1", data:"${D(0)}", saldo_informado:1000 }];
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

  /* OS NÚMEROS SÃO OS DO APP, não cópias.  Se o Balanço recalculasse "o
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
    conferencias = [{ id:"c1", data:"${D(0)}", saldo_informado:200 }];
    contas = [{ id:"k1", nome:"Aluguel", valor:1400,
                vencimento:mesDe(_hojeLocal()) + "-27", pago:false, categoria:"Casa" }];
    abrirBalanco();`);
  const aperto = await p.locator(".balanco-conta > div").allTextContents();
  ok("faltando dinheiro, a última linha diz FALTA", aperto[3].includes("Falta"));
  ok("com o valor sem sinal de menos grudado", aperto[3].includes("1.200,00"));
  ok("e veste vermelho", (await p.locator(".balanco-conta-fim.ruim").count()) === 1);
  ok("o rodapé diz o tamanho do aperto",
    (await texto(".rel-rodape")).includes("1.200,00"));


  /* ─── CONFERIR: O FORMULÁRIO ─────────────────────────────────────── */
  await abrir(BASE + PAR + "; abrirNovaConferencia();");
  ok("o campo do saldo começa VAZIO, de propósito",
    (await p.inputValue("#cf-saldo")) === "");
  ok("a data começa hoje", (await p.inputValue("#cf-data")) === HJ);
  ok("e não aceita data no futuro nem no calendário",
    (await p.getAttribute("#cf-data", "max")) === HJ);
  const dica = await texto("#cf-previa");
  ok("a dica manda abrir o banco", dica.includes("app do seu banco"));
  ok("e já diz o que o app espera", dica.includes("2.550,00"));

  /* A PRÉVIA ENQUANTO DIGITA. É o momento em que a informação vale mais:
     ainda dá pra ver que foi engano de digitação antes de gravar. */
  await p.fill("#cf-saldo", "2500,00");
  ok("digitando menos, a prévia diz quanto falta",
    (await texto("#cf-previa")).includes("50,00") &&
    (await texto("#cf-previa")).includes("a menos"));
  await p.fill("#cf-saldo", "2600,00");
  ok("digitando mais, ela diz que sobrou",
    (await texto("#cf-previa")).includes("a mais"));
  await p.fill("#cf-saldo", "2550,00");
  ok("digitando o valor certo, ela diz que bate",
    (await texto("#cf-previa")).includes("Bate certinho"));

  /* Primeira conferência não tem o que comparar, e a tela não finge que
     tem: ela explica que aquele número vira o ponto de partida. */
  await abrir(BASE + "; abrirNovaConferencia();");
  ok("na primeira vez, a dica fala de ponto de partida",
    (await texto("#cf-previa")).includes("ponto de partida"));
  ok("sem citar um esperado que não existe",
    !(await texto("#cf-previa")).includes("O app espera"));


  /* ─── CONFERIR: GRAVAR ──────────────────────────────────────────── */
  await abrir(BASE + PAR + "; abrirNovaConferencia();");
  await p.fill("#cf-saldo", "2.480,00");
  await p.click(".botao");
  const g = await chamadas();
  ok("salvar grava UMA linha", g.length === 1 && g[0].tabela === "conferencias");
  ok("como insert", g[0].op === "insert");
  ok("com o saldo lido do campo, milhar e tudo", g[0].dados.saldo_informado === 2480);
  ok("a data de hoje", g[0].dados.data === HJ);
  ok("e o dono", g[0].dados.user_id === "u1");
  ok("SÓ o fato é gravado — a diferença não vira campo",
    !("diferenca" in g[0].dados) && !("esperado" in g[0].dados) &&
    !("saldo_calculado" in g[0].dados));
  ok("e o aviso já diz o tamanho da diferença",
    (await texto("#avisos")).includes("70,00"));

  /* Saldo ZERO é saldo. Conta zerada existe, e recusar o zero obrigaria a
     pessoa a mentir ou a não conferir. */
  await abrir(BASE + "; abrirNovaConferencia();");
  await p.fill("#cf-saldo", "0");
  await p.click(".botao");
  const zero = await chamadas();
  ok("saldo zero é aceito", zero.length === 1 && zero[0].dados.saldo_informado === 0);

  await abrir(BASE + "; abrirNovaConferencia();");
  await p.click(".botao");
  ok("campo vazio não grava nada", (await chamadas()).length === 0);
  ok("e diz o que falta", (await texto("#avisos")).includes("saldo"));

  /* SALDO NEGATIVO tem duas trancas, e a primeira é o teclado: o
     formatador de dinheiro do app já come o sinal de menos enquanto se
     digita. A segunda é a conferência aqui embaixo, pra quando o valor
     chegar por outro caminho. */
  await abrir(BASE + "; abrirNovaConferencia();");
  await p.fill("#cf-saldo", "-300");
  ok("o campo de dinheiro não deixa nem digitar o menos",
    (await p.inputValue("#cf-saldo")) === "300");

  // Atribuir sem disparar o 'input' é o único jeito de chegar na tranca
  // de baixo — que é justamente o caso que ela existe pra cobrir.
  await abrir(BASE + `; abrirNovaConferencia();
    document.getElementById("cf-saldo").value = "-300";`);
  await p.click(".botao");
  ok("e, se um negativo chegar de outro jeito, não grava",
    (await chamadas()).length === 0);
  ok("explicando que cheque especial é dívida, não saldo",
    (await texto("#avisos")).includes("dívida"));

  /* Data no futuro: o campo já barra no calendário, mas quem digita à mão
     passa por cima do max. */
  await abrir(BASE + `; abrirNovaConferencia();
    document.getElementById("cf-data").value = "${D(+10)}";`);
  await p.fill("#cf-saldo", "1000");
  await p.click(".botao");
  ok("data no futuro não grava", (await chamadas()).length === 0);
  ok("e a tela diz por quê", (await texto("#avisos")).includes("futuro"));

  /* Uma por dia: duas no mesmo dia tornariam ambígua a pergunta "quanto
     eu tinha naquele dia?", que é a que ancora todo o resto. */
  await abrir(BASE + PAR + "; abrirNovaConferencia();");
  await falharProxima("23505", "duplicate key value violates unique constraint");
  await p.fill("#cf-saldo", "2550");
  await p.click(".botao");
  ok("conferência repetida no mesmo dia é recusada com explicação",
    (await texto("#avisos")).includes("Já existe uma conferência nesse dia"));
  ok("e a tela não volta como se tivesse dado certo",
    (await p.locator("#cf-saldo").count()) === 1);


  /* ─── APAGAR É O JEITO DE REFAZER ────────────────────────────────────
     Uma por dia, e um saldo digitado errado estraga todas as contas dali
     pra frente, porque ele é a âncora. */
  await abrir(BASE + PAR + "; abrirBalanco();");
  await p.evaluate(() => pedirExcluirConferencia("cfb"));
  const pedido = await texto("#balanco-confirma");
  ok("apagar pede confirmação", (await p.locator(".confirmar").count()) === 1);
  ok("dizendo qual conferência é", pedido.includes("2.150,00"));
  ok("e o que acontece com as contas", pedido.includes("conferência anterior"));

  await p.click(".confirmar .sim");
  const ap = await chamadas();
  ok("apaga só aquela linha",
    ap.length === 1 && ap[0].tabela === "conferencias" && ap[0].op === "delete");
  ok("presa ao dono, não só ao id",
    ap[0].eq.some(e => e[0] === "id" && e[1] === "cfb") &&
    ap[0].eq.some(e => e[0] === "user_id"));
  /* 2.000 da primeira conferência, mais 500 − 300 + 400 do que se moveu
     DEPOIS dela: R$ 2.600. Note que o −1.000 do dia dela continua de
     fora, e é a mesma regra de limite valendo com outra âncora. */
  ok("e as contas voltam pra âncora anterior",
    (await p.evaluate(() => saldoDeHoje().valor)) === 2600);
  ok("a tela se redesenha sem ela",
    (await p.locator("#conf-cfb").count()) === 0 &&
    (await p.locator("#conf-cfa").count()) === 1);

  await abrir(BASE + PAR + "; abrirBalanco();");
  await p.evaluate(() => pedirExcluirConferencia("cfb"));
  await p.click(".confirmar button:not(.sim)");
  ok("cancelar não apaga nada", (await chamadas()).length === 0);
  ok("e a conferência continua lá", (await p.locator("#conf-cfb").count()) === 1);


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
  const semBanco = await texto("#area");
  ok("a tela explica que falta rodar o banco.sql",
    semBanco.includes("banco.sql") && semBanco.includes("SQL Editor"));
  ok("e não mostra saldo nenhum", (await p.locator(".contas-total").count()) === 0);
  ok("nem a projeção do mês", (await p.locator(".balanco-conta").count()) === 0);

  await p.evaluate(() => voltarInicio());
  await p.evaluate(() => abrirResumo());
  ok("e o Resumo abre normalmente do lado", (await p.locator(".saldo").count()) === 1);


  /* ─── A LISTA ────────────────────────────────────────────────────── */
  await abrir(BASE + PAR + "; abrirBalanco();");
  const itens = await p.locator(".lista .item").count();
  ok("as duas conferências aparecem na lista", itens === 2);
  const primeiro = await texto(".lista .item:first-child .item-txt");
  ok("a mais recente vem primeiro", primeiro.includes("2.150,00"));
  ok("com a data por extenso", primeiro.includes("/"));
});

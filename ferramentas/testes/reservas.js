/* DUAS TELAS, UM NÚMERO SÓ.
 *
 * É a suíte mais importante do app. Ela não testa uma tela: testa que as
 * telas CONCORDAM. Três vezes neste projeto o defeito foi dois números
 * para a mesma coisa em lugares diferentes, e as três vezes o usuário
 * descobriu antes do código.
 *
 * O que ela trava:
 *   - Metas e Resumo dizendo gastos diferentes pra mesma categoria
 *   - a fatura do cartão sumindo do "ainda vai sair"
 *   - a mesma despesa sendo reservada duas vezes
 *   - mês fechado continuando a prometer que algo "ainda vai sair"
 */

const { suite } = require("./_apoio");

// Mercado com meta de 1.000: R$ 300 já no cartão, R$ 200 no extrato.
// A fatura que vence no mês tem as compras do mês passado.
const CENARIO = `
  cartoes = [{ id:"k1", nome:"Nubank", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
  comprasCartao = [
    { id:"c1", cartao_id:"k1", descricao:"Mercado", valor:300, parcelas:1,
      data:"2026-10-01", categoria:"Mercado", recorrente:false, fim:null },
  ];
  lancamentos = [
    { id:"e1", tipo:"entrada", valor:4000, data:"2026-10-01", categoria:"Salário", descricao:"Salário" },
    { id:"s1", tipo:"saida", valor:200, data:"2026-10-03", categoria:"Mercado", descricao:"Feira" },
  ];
  metas = [{ id:"m1", categoria:"Mercado", valor:1000, reservar:true }];
  contas = []; pagamentosFatura = []; fechamentos = []; entradasFixas = [];
  mesAtual = "2026-10";
`;

module.exports = () => suite("Metas, Resumo e reservas", async ({ p, ok, abrir, texto, valor }) => {

  /* ─── A MESMA FUNÇÃO, NÃO UMA CÓPIA ──────────────────────────────────
     O Resumo dizia "Mercado, ainda vai sair R$ 1.000" enquanto as Metas
     diziam "sobram R$ 683,61", porque um contava a compra no cartão e o
     outro não. Agora os dois chamam _gastoDoMesPorCategoria. */
  await abrir(CENARIO);
  const gasto = await p.evaluate(() => _gastoDoMesPorCategoria("2026-10").Mercado);
  ok("gasto da categoria = extrato + cartão", gasto === 500);

  const reserva = await p.evaluate(() =>
    reservasDoMes("2026-10").linhas.find(l => l.tipo === "meta"));
  ok("a meta reserva só o que falta dela", reserva.falta === 500);
  ok("e mostra o mesmo gasto que as Metas mostram", reserva.gasto === gasto);

  // A tela de Metas, desenhada, tem que dizer o mesmo número.
  await abrir(CENARIO + "; abrirMetas();");
  const naTela = valor(await texto(".meta-item .meta-baixo strong"));
  ok("a tela de Metas mostra exatamente esse gasto", naTela === gasto);

  /* ─── A FATURA ENTRA NO QUE AINDA VAI SAIR ───────────────────────────
     O mês somava contas e metas e mostrava sobra com uma fatura caindo no
     dia 10 — a maior conta da casa, a única que o app sabia calcular e
     não reservava. */
  await abrir(CENARIO + `; comprasCartao.push({ id:"c0", cartao_id:"k1", descricao:"TV",
     valor:800, parcelas:1, data:"2026-09-15", categoria:"Casa", recorrente:false, fim:null });`);
  const r = await p.evaluate(() => reservasDoMes("2026-10"));
  const fatura = r.linhas.find(l => l.tipo === "fatura");
  ok("a fatura aparece no 'ainda vai sair'", !!fatura);
  // A fatura de outubro junta a TV de setembro (800) e o mercado do dia 1º
  // (300) — o cartão fecha dia 1, então o dia 1º ainda entra nela.
  ok("pelo total do que falta nela", fatura.falta === 1100);
  ok("e pelo mês em que VENCE, não o da fatura", fatura.vencimento === "2026-10-10");

  /* ─── E NÃO CONTA EM DOBRO COM A META ────────────────────────────────
     Parece que sim, e não é: a compra no cartão já entrou como gasto, e
     gasto ABATE a reserva da meta em vez de somar. Meta de 1.000 com
     R$ 500 gastos reserva 500; a fatura reserva o que vence. */
  await abrir(CENARIO + `; comprasCartao[0].data = "2026-09-20";`);
  const r2 = await p.evaluate(() => reservasDoMes("2026-10"));
  const meta2 = r2.linhas.find(l => l.tipo === "meta");
  const fat2 = r2.linhas.find(l => l.tipo === "fatura");
  // Setembro: 300 no cartão. Outubro: 200 no extrato → meta falta 800.
  // A fatura de outubro cobra os 300 de setembro.
  ok("a meta reserva o que falta dela em outubro", meta2.falta === 800);
  ok("a fatura reserva o que vai sair da conta", fat2.falta === 300);
  ok("e o total é a soma, sem repetição", r2.total === 1100);

  /* ─── O total do bloco é a soma das linhas ───────────────────────── */
  await abrir(CENARIO + "; abrirResumo();");
  const linhas = await p.locator(".resumo-secao:has(h2:text-is('Ainda vai sair')) .item-valor").allTextContents();
  const soma = Math.round(linhas.reduce((s, v) => s + valor(v), 0) * 100) / 100;
  const cabecalho = valor(await texto(".resumo-total-saida"));
  ok("o total do bloco soma exatamente as linhas", soma === cabecalho);

  /* ─── Conta paga sai da reserva sozinha ──────────────────────────── */
  await abrir(CENARIO + `; contas = [{ id:"cz", nome:"Luz", valor:180,
     vencimento:"2026-10-20", pago:false, categoria:"Casa", recorrente:true }];`);
  const comConta = await p.evaluate(() => reservasDoMes("2026-10").total);
  await abrir(CENARIO + `; contas = [{ id:"cz", nome:"Luz", valor:180,
     vencimento:"2026-10-20", pago:true, pago_em:"2026-10-19", categoria:"Casa", recorrente:true }];`);
  const semConta = await p.evaluate(() => reservasDoMes("2026-10").total);
  ok("conta paga deixa de ser reservada", Math.round((comConta - semConta) * 100) === 18000);

  /* ─── Mês que já acabou não promete nada ─────────────────────────────
     Reservar é dizer "isto ainda vai sair", e num mês fechado nada mais
     sai dele. Sem esta regra, agosto mostrava "sobra −R$ 200" no topo e
     "sobraram R$ 257" no botão de fechar — na mesma tela. */
  await abrir(CENARIO);
  const passado = await p.evaluate(() => reservasDoMes(mesVizinho(mesDe(_hojeLocal()), -1)));
  ok("mês passado não reserva nada", passado.total === 0 && passado.linhas.length === 0);

  /* ─── O pagamento da fatura não é gasto de novo ──────────────────────
     Ele é a mesma despesa chegando pela segunda vez: as compras já foram
     contadas uma a uma, cada uma na sua categoria. */
  await abrir(CENARIO + `;
    lancamentos.push({ id:"fat", tipo:"saida", valor:900, data:"2026-10-10",
                       categoria:"Cartão", descricao:"Fatura Nubank" });
    pagamentosFatura.push({ id:"pf", cartao_id:"k1", mes_ref:"2026-10", tipo:"pago",
                            valor:900, pago_em:"2026-10-10", lancamento_id:"fat" });`);
  const porCat = await p.evaluate(() => _gastoDoMesPorCategoria("2026-10"));
  ok("pagar a fatura não vira gasto novo", !porCat.Cartão);
  ok("e o mercado continua o mesmo", porCat.Mercado === 500);
});

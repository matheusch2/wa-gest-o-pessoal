/* O APP VELHO QUE NÃO SABIA QUE ERA VELHO.
 *
 * O ?v=N de cada arquivo resolve o cache do JS e do CSS — mas ele mora
 * DENTRO do index.html, e o index.html não tem versão nenhuma. Quando o
 * celular serve o index do cache, ele continua pedindo o ?v= antigo e
 * nunca descobre que existe um novo: os números estão dentro do arquivo
 * que não atualizou.
 *
 * Aconteceu de verdade: o deploy subiu, o servidor serviu a versão nova e
 * o dono do app continuou vendo a antiga, sem nenhum sinal de que era
 * antiga. Num app de dinheiro isso é grave de um jeito específico — um
 * defeito já corrigido continua aparecendo, e a pessoa perde a confiança
 * no que a tela diz.
 *
 * Esta suíte trava as duas pontas: que os dois números concordam, e que o
 * app faz a coisa certa quando eles não concordam.
 */

const fs = require("fs");
const path = require("path");
const { suite, RAIZ } = require("./_apoio");

module.exports = () => suite("Versão e cache", async ({ p, ok, abrir, texto }) => {

  /* ─── UM NÚMERO, DUAS CÓPIAS, SEMPRE IGUAIS ──────────────────────────
     Se discordarem por engano, o app recarrega uma vez, vê que continua
     diferente e avisa por escrito. Nada quebra — mas a conferência deixa
     de servir pra exatamente aquilo que ela existe. Por isso o selo é
     gerado do core.js, e esta conferência existe pra pegar o dia em que
     eu esquecer de rodar o gerador. */
  const core = fs.readFileSync(path.join(RAIZ, "js/core.js"), "utf8");
  const noCodigo = core.match(/const VERSAO_APP = "([^"]+)";/)?.[1];
  const noSelo = JSON.parse(fs.readFileSync(path.join(RAIZ, "versao.json"), "utf8")).versao;
  ok("o versao.json existe e tem versão", !!noSelo);
  ok("e bate com o VERSAO_APP do core.js", noSelo === noCodigo);

  /* ─── MESMA VERSÃO: NÃO MEXE EM NADA ─────────────────────────────── */
  const armar = (respostaDoServidor) => `
    window.RECARREGOU = 0;
    _recarregarApp = () => { window.RECARREGOU++; };
    sessionStorage.removeItem("wa-recarregou-por-versao");
    window.fetch = () => ${respostaDoServidor};
  `;
  const ok200 = (v) => `Promise.resolve({ ok: true, json: () => Promise.resolve({ versao: ${JSON.stringify(v)} }) })`;

  await abrir(armar(ok200(noCodigo)) + "; conferirVersao();");
  await p.waitForTimeout(80);
  ok("versão igual não recarrega nada",
    (await p.evaluate(() => window.RECARREGOU)) === 0);

  /* ─── VERSÃO DIFERENTE: RECARREGA UMA VEZ ────────────────────────── */
  await abrir(armar(ok200("9999-99-99 · 999")) + "; conferirVersao();");
  await p.waitForTimeout(80);
  ok("versão diferente recarrega o app",
    (await p.evaluate(() => window.RECARREGOU)) === 1);
  ok("e deixa a marca de que já tentou",
    (await p.evaluate(() => sessionStorage.getItem("wa-recarregou-por-versao"))) === "1");

  /* ─── A TRAVA CONTRA O LAÇO INFINITO ─────────────────────────────────
     Sem ela, dois números que discordassem por engano meu fariam o app
     recarregar pra sempre — inutilizável, e sem nenhuma pista do motivo.
     Num app que a pessoa abre pra ver quanto tem na conta, um aviso é
     sempre melhor do que um laço. */
  await abrir(armar(ok200("9999-99-99 · 999")) + `
    sessionStorage.setItem("wa-recarregou-por-versao", "1");
    conferirVersao();`);
  await p.waitForTimeout(120);
  ok("já tendo recarregado, não recarrega de novo",
    (await p.evaluate(() => window.RECARREGOU)) === 0);
  ok("avisa por escrito, com a versão que o servidor tem",
    (await texto(".aviso.erro")).includes("9999-99-99 · 999"));

  // E a marca é limpa quando as versões voltam a bater, pra uma
  // atualização futura poder recarregar de novo.
  await abrir(armar(ok200(noCodigo)) + `
    sessionStorage.setItem("wa-recarregou-por-versao", "1");
    conferirVersao();`);
  await p.waitForTimeout(80);
  ok("e a marca some quando as versões voltam a bater",
    (await p.evaluate(() => sessionStorage.getItem("wa-recarregou-por-versao"))) === null);

  /* ─── SEM INTERNET, NADA ACONTECE ────────────────────────────────────
     A conferência é o extra; a tela é o que importa. Um app que se
     recusasse a abrir por não conseguir conferir a versão seria pior do
     que um app desatualizado. */
  await abrir(`
    window.RECARREGOU = 0;
    _recarregarApp = () => { window.RECARREGOU++; };
    sessionStorage.removeItem("wa-recarregou-por-versao");
    window.fetch = () => Promise.reject(new Error("offline"));
    conferirVersao();`);
  await p.waitForTimeout(80);
  ok("sem internet, não recarrega", (await p.evaluate(() => window.RECARREGOU)) === 0);
  ok("e não avisa nada", (await p.locator(".aviso").count()) === 0);

  // Arquivo que ainda não subiu (404) também não pode quebrar nada.
  await abrir(`
    window.RECARREGOU = 0;
    _recarregarApp = () => { window.RECARREGOU++; };
    window.fetch = () => Promise.resolve({ ok: false, status: 404 });
    conferirVersao();`);
  await p.waitForTimeout(80);
  ok("versao.json faltando também não quebra nada",
    (await p.evaluate(() => window.RECARREGOU)) === 0 &&
    (await p.locator(".aviso").count()) === 0);

  /* ─── O ARQUIVO É BUSCADO SEM CACHE ──────────────────────────────────
     Se o versao.json viesse do cache junto com o index, ele diria a
     versão velha e concordaria com ela — a conferência passaria a
     garantir exatamente nada. */
  await abrir(`
    window.PEDIDO = null;
    window.fetch = (url, opcoes) => {
      window.PEDIDO = { url, opcoes };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ versao: VERSAO_APP }) });
    };
    conferirVersao();`);
  await p.waitForTimeout(80);
  const pedido = await p.evaluate(() => window.PEDIDO);
  ok("o versao.json é pedido com a hora na URL", /versao\.json\?t=\d+/.test(pedido.url));
  ok("e com no-store, pra não vir do cache", pedido.opcoes.cache === "no-store");
});

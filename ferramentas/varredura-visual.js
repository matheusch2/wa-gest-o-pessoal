#!/usr/bin/env node
/* Varredura visual do WA Finanças. Uso:
 *   node ferramentas/montar-pagina-de-teste.js
 *   node ferramentas/varredura-visual.js
 *
 * Abre todas as telas de telas.json e procura os três estragos que uma
 * mexida no CSS costuma causar sem ninguém ver: a página passando a rolar
 * pro lado, texto que virou pequeno demais pra ler, e elemento com texto
 * que ficou sem tamanho nenhum. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
// O Chromium normal do Playwright serve. Num ambiente onde ele esteja em
// outro lugar, aponte com CHROMIUM=/caminho/do/chromium antes do comando.
const COMO_ABRIR = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};

const TELAS = JSON.parse(fs.readFileSync(path.join(__dirname, "telas.json"), "utf8"));
const PAGINA = "file://" + path.resolve(__dirname, "../_audit.html");

(async () => {
  const b = await chromium.launch(COMO_ABRIR);
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on("pageerror", e => { if (!/onAuthStateChange|getSession/.test(e.message)) console.log("ERRO JS:", e.message); });

  const problemas = [];
  for (const [nome, acao] of TELAS) {
    await p.goto(PAGINA);
    await p.waitForFunction("window.__pronto === true");
    try { await p.evaluate(acao); } catch (e) { problemas.push(nome + ": não abriu — " + e.message.slice(0, 60)); continue; }
    await p.waitForTimeout(80);
    const r = await p.evaluate(() => {
      const ruins = [];
      if (document.documentElement.scrollWidth > window.innerWidth + 1) ruins.push("a página rola pro lado");
      for (const el of document.querySelectorAll("#area *, #menu *")) {
        // <option> não tem caixa própria, e o que está dentro de algo
        // escondido está escondido de propósito — nem um nem outro é defeito.
        if (/^(OPTION|SELECT|SCRIPT|STYLE)$/.test(el.tagName)) continue;
        if (el.closest("[hidden]")) continue;
        if (el.childElementCount || !el.textContent.trim()) continue;
        const c = getComputedStyle(el);
        if (parseFloat(c.fontSize) < 9) ruins.push("texto miúdo demais: ." + el.className);
        const cx = el.getBoundingClientRect();
        if (cx.width === 0 && cx.height === 0 && c.display !== "none") {
          ruins.push("sumiu: <" + el.tagName.toLowerCase() + " class=\"" + el.className + "\"> " + el.textContent.trim().slice(0, 30));
        }
      }
      return ruins;
    });
    for (const x of r) problemas.push(nome + ": " + x);
  }

  console.log(problemas.length ? problemas.join("\n") : `nenhuma tela quebrada nas ${TELAS.length}`);
  await b.close();
  process.exit(problemas.length ? 1 : 0);
})();

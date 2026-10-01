#!/usr/bin/env node
/* Roda todas as suítes de teste do WA Finanças. Uso:
 *
 *   node ferramentas/montar-pagina-de-teste.js
 *   node ferramentas/testes/rodar.js
 *
 * Uma suíte só:  node ferramentas/testes/rodar.js cartao
 *
 * Estes testes não entram no site. Eles abrem o app de verdade num
 * navegador sem tela, trocam os dados por um cenário e conferem o que
 * aparece — e, quando a tela grava alguma coisa, o que ela mandou pro
 * banco.
 */

const fs = require("fs");
const path = require("path");

const AQUI = __dirname;
const filtro = process.argv.slice(2);

const suites = fs.readdirSync(AQUI)
  .filter(f => f.endsWith(".js") && !f.startsWith("_") && f !== "rodar.js")
  .map(f => f.replace(/\.js$/, ""))
  .filter(n => !filtro.length || filtro.includes(n))
  .sort();

if (!suites.length) {
  console.log("Nenhuma suíte com esse nome. Existem: " +
    fs.readdirSync(AQUI).filter(f => f.endsWith(".js") && !f.startsWith("_") && f !== "rodar.js")
      .map(f => f.replace(/\.js$/, "")).join(", "));
  process.exit(1);
}

if (!fs.existsSync(path.resolve(AQUI, "../../_audit.html"))) {
  console.log("Falta a página de teste. Rode antes:\n  node ferramentas/montar-pagina-de-teste.js");
  process.exit(1);
}

(async () => {
  const resultados = [];
  for (const nome of suites) {
    resultados.push(await require(path.join(AQUI, nome + ".js"))());
  }

  const total = resultados.reduce((s, r) => s + r.total, 0);
  const falhou = resultados.reduce((s, r) => s + r.falhou, 0);

  console.log("\n" + "─".repeat(52));
  for (const r of resultados) {
    console.log(`  ${r.falhou ? "✗" : "✓"}  ${r.nome.padEnd(32)} ${r.total - r.falhou}/${r.total}`);
  }
  console.log("─".repeat(52));
  console.log(falhou
    ? `\n${falhou} de ${total} conferências falharam.`
    : `\nTudo certo — ${total} conferências.`);

  process.exit(falhou ? 1 : 0);
})();

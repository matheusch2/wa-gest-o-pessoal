#!/usr/bin/env node
/* Auditor de CSS do WA Finanças. Uso:  node ferramentas/rodar.js  */
const fs = require("fs");
const { chromium } = require("playwright");
const AUD = fs.readFileSync(__dirname + "/auditor-css.js", "utf8");

const TELAS = JSON.parse(fs.readFileSync(__dirname + "/telas.json", "utf8"));

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => { if (!/onAuthStateChange|getSession|Chart/.test(e.message)) console.log("  ERRO JS:", e.message); });

  const todos = new Map();
  for (const [nome, acao] of TELAS) {
    await p.goto("file://" + require("path").resolve(__dirname, "../_audit.html"));
    await p.waitForFunction("window.__pronto === true");
    try { await p.evaluate(acao); } catch (e) { console.log("  não abriu:", nome, e.message.slice(0, 80)); continue; }
    await p.waitForTimeout(120);
    await p.evaluate(AUD);
    const achados = await p.evaluate("window.__auditar()");
    for (const a of achados) {
      const k = a.elemento + "|" + a.prop + "|" + a.venceu + "|" + a.perdeu;
      if (!todos.has(k)) todos.set(k, { ...a, telas: [] });
      todos.get(k).telas.push(nome);
    }
  }

  const lista = [...todos.values()];
  console.log(`\n${lista.length} colisão(ões) — regra de fora vencendo a regra do próprio componente\n`);
  for (const a of lista) {
    console.log("• " + a.elemento + "   [" + a.prop + "]");
    console.log("    venceu: " + a.venceu);
    console.log("    perdeu: " + a.perdeu);
    console.log("    telas:  " + [...new Set(a.telas)].join(", "));
    console.log("");
  }
  await b.close();
})();

#!/usr/bin/env node
/* Confere os ícones e o manifesto. Uso:  node ferramentas/teste-icones.js
 *
 * Existe porque o iPhone IGNORA webp no ícone de tela inicial, sem dar
 * erro nenhum: sai um quadrado branco e ninguém sabe por quê. Este teste
 * reprova qualquer ícone que volte a apontar pra webp. */
const fs = require("fs");
const { chromium } = require("playwright");
const R = require("path").resolve(__dirname, "..");

(async () => {
  // Mesmo esquema das outras ferramentas: CHROMIUM=... se o seu estiver
  // em outro lugar.
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", () => {});

  let falhou = 0;
  const ok = (n, c) => { console.log((c ? "  ok  " : "FALHOU") + "  " + n); if (!c) falhou++; };

  await p.goto("file://" + R + "/index.html");
  await p.waitForTimeout(200);

  const links = await p.evaluate(() =>
    [...document.querySelectorAll('link[rel*="icon"], link[rel="manifest"]')]
      .map(l => ({ rel: l.rel, href: l.getAttribute("href"), tipo: l.type, sizes: l.getAttribute("sizes") })));

  ok("o apple-touch-icon aponta pra um PNG",
    links.some(l => l.rel === "apple-touch-icon" && /icone-180\.png/.test(l.href)));
  ok("nenhum ícone continua em webp", !links.some(l => /\.webp/.test(l.href)));
  ok("tem manifesto declarado", links.some(l => l.rel === "manifest"));

  /* ── Os arquivos existem, no tamanho declarado ───────────────────── */
  const esperados = { "icone-32.png": 32, "icone-180.png": 180, "icone-192.png": 192, "icone-512.png": 512, "icone-maskable-512.png": 512 };
  for (const [arq, lado] of Object.entries(esperados)) {
    const existe = fs.existsSync(R + "/assets/" + arq);
    ok(`${arq} existe`, existe);
    if (!existe) continue;
    const dim = await p.evaluate(src => new Promise(r => {
      const i = new Image();
      i.onload = () => r(i.naturalWidth + "x" + i.naturalHeight);
      i.onerror = () => r("erro");
      i.src = src;
    }), "assets/" + arq);
    ok(`  e é ${lado}x${lado} de verdade (${dim})`, dim === lado + "x" + lado);
  }

  /* ── O manifesto é JSON válido e completo ────────────────────────── */
  const m = JSON.parse(fs.readFileSync(R + "/manifest.json", "utf8"));
  ok("o manifesto tem nome", m.name === "WA Finanças" && !!m.short_name);
  ok("abre em tela cheia, sem barra do navegador", m.display === "standalone");
  ok("com a cor da marca no fundo e na barra",
    m.background_color === "#0f3b5c" && m.theme_color === "#0f3b5c");
  ok("tem o 192 e o 512, que é o que o Android pede",
    m.icons.some(i => i.sizes === "192x192") && m.icons.some(i => i.sizes === "512x512"));
  ok("e um maskable, pro Android não recortar o nome",
    m.icons.some(i => i.purpose === "maskable"));
  ok("todo ícone do manifesto existe no disco",
    m.icons.every(i => fs.existsSync(R + "/" + i.src)));
  ok("o start_url é relativo — funciona no github.io e num domínio próprio",
    m.start_url === "./" && m.scope === "./");

  console.log(falhou ? "\n" + falhou + " problema(s)" : "\nTodos passaram");
  await b.close();
  process.exit(falhou ? 1 : 0);
})();

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

  /* ── As telas de abertura do Safari ──────────────────────────────────
     Se uma faltar, ou tiver o tamanho errado, o iPhone não avisa nada: só
     abre em branco naquele aparelho. Ninguém descobre sem ter o modelo na
     mão — daí a conferência aqui. */
  const html = fs.readFileSync(R + "/index.html", "utf8");
  const aberturas = [...html.matchAll(
    /rel="apple-touch-startup-image"\s+href="assets\/abertura\/((\d+)x(\d+)\.png)[^"]*"\s+media="([^"]+)"/g)];

  ok(`declara ${aberturas.length} telas de abertura`, aberturas.length >= 12);

  const vistas = new Set();
  let todasOk = true, mediaOk = true;
  for (const [, arq, w, h, media] of aberturas) {
    if (!fs.existsSync(R + "/assets/abertura/" + arq)) { todasOk = false; console.log("    falta", arq); continue; }
    const dim = await p.evaluate(src => new Promise(r => {
      const i = new Image();
      i.onload = () => r(i.naturalWidth + "x" + i.naturalHeight);
      i.onerror = () => r("erro");
      i.src = src;
    }), "assets/abertura/" + arq);
    if (dim !== `${w}x${h}`) { todasOk = false; console.log(`    ${arq} é ${dim}`); }

    // A media query tem que casar com o nome do arquivo: largura x dpr.
    const lg = Number((media.match(/device-width:\s*(\d+)px/) || [])[1]);
    const al = Number((media.match(/device-height:\s*(\d+)px/) || [])[1]);
    const dpr = Number((media.match(/pixel-ratio:\s*(\d+)/) || [])[1]);
    if (lg * dpr !== Number(w) || al * dpr !== Number(h)) {
      mediaOk = false;
      console.log(`    ${arq}: a media query pede ${lg * dpr}x${al * dpr}`);
    }
    vistas.add(`${lg}x${al}@${dpr}`);
  }

  ok("cada uma existe e tem o tamanho exato do nome", todasOk);
  ok("e a media query casa com o arquivo que ela escolhe", mediaOk);
  ok("sem dois <link> disputando o mesmo aparelho", vistas.size === aberturas.length);

  const sobrando = fs.readdirSync(R + "/assets/abertura").filter(a =>
    a.endsWith(".png") && !aberturas.some(l => l[1] === a));
  ok("e nenhuma imagem de abertura sobrando sem <link>",
    sobrando.length === 0 || (console.log("    sobrando:", sobrando.join(", ")), false));

  console.log(falhou ? "\n" + falhou + " problema(s)" : "\nTodos passaram");
  await b.close();
  process.exit(falhou ? 1 : 0);
})();

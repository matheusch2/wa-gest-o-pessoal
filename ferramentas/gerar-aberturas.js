/*
 * Gera as telas de abertura do iPhone e do iPad.
 *
 *     node ferramentas/gerar-aberturas.js
 *
 * POR QUE ISTO EXISTE: o Android monta a tela de abertura sozinho, com a cor
 * e o ícone do manifest.json. O Safari não — ele exige uma IMAGEM PRONTA no
 * tamanho exato de cada aparelho, e se não achar a do aparelho em questão
 * mostra uma tela branca. Daí a lista abaixo.
 *
 * Cada linha é: largura x altura em pixels de verdade (não em CSS), e quais
 * aparelhos usam aquilo. As medidas em CSS e o "dpr" viram a media query lá
 * no index.html — é ela que faz o Safari escolher a imagem certa.
 *
 * Aparelho novo no mercado = mais uma linha aqui e mais um <link> lá. Sem a
 * linha, aquele aparelho volta a abrir em branco: não quebra, mas fica feio.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.NODE_PATH
  ? path.join(process.env.NODE_PATH, "playwright")
  : "playwright");

const RAIZ = path.join(__dirname, "..");
const FUNDO = "#0f3b5c";   // a mesma --marca do style.css e do manifest

// [ larguraCSS, alturaCSS, dpr, "quem usa" ]
const APARELHOS = [
  [440, 956, 3, "iPhone 16 Pro Max"],
  [402, 874, 3, "iPhone 16 Pro"],
  [430, 932, 3, "iPhone 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max"],
  [393, 852, 3, "iPhone 16, 15 Pro, 15, 14 Pro"],
  [428, 926, 3, "iPhone 14 Plus, 13 Pro Max, 12 Pro Max"],
  [390, 844, 3, "iPhone 14, 13, 13 Pro, 12, 12 Pro"],
  [375, 812, 3, "iPhone 13 mini, 12 mini, 11 Pro, XS, X"],
  [414, 896, 3, "iPhone 11 Pro Max, XS Max"],
  [414, 896, 2, "iPhone 11, XR"],
  [414, 736, 3, "iPhone 8 Plus, 7 Plus, 6s Plus"],
  [375, 667, 2, "iPhone SE (2ª e 3ª), 8, 7, 6s"],
  [320, 568, 2, "iPhone SE (1ª), 5s"],
  [768, 1024, 2, "iPad 9.7 e iPad mini"],
  [834, 1194, 2, "iPad Pro 11 e iPad Air"],
  [1024, 1366, 2, "iPad Pro 12.9"],
];

const simbolo = fs.readFileSync(path.join(RAIZ, "assets", "simbolo-wa.svg"), "utf8")
  .replace(/<!--[\s\S]*?-->/g, "").trim();

// O símbolo ocupa 26% da largura, mas nunca mais que 14% da altura — sem esse
// teto ele fica gigante no iPad, que é largo.
const pagina = (w, h) => {
  const tamanho = Math.round(Math.min(w * 0.26, h * 0.14));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body { margin:0; padding:0; width:${w}px; height:${h}px; overflow:hidden; }
    body { background:${FUNDO}; display:grid; place-items:center; }
    svg { width:${tamanho}px; height:${tamanho}px; display:block; }
  </style></head><body>${simbolo}</body></html>`;
};

(async () => {
  const navegador = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
  });
  const destino = path.join(RAIZ, "assets");
  let total = 0;

  for (const [wCss, hCss, dpr, quem] of APARELHOS) {
    const w = wCss * dpr, h = hCss * dpr;
    // A página é montada em pixels de verdade, com dpr 1: o que sai do
    // screenshot é exatamente o arquivo que o aparelho vai receber.
    const pag = await navegador.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await pag.setContent(pagina(w, h));
    const arquivo = path.join(destino, `abertura-${w}x${h}.png`);
    await pag.screenshot({ path: arquivo });
    await pag.close();
    console.log(`  ${String(w).padStart(4)}x${String(h).padStart(4)}  ${quem}`);
    total++;
  }

  await navegador.close();
  console.log(`\n${total} telas de abertura em assets/`);
})();

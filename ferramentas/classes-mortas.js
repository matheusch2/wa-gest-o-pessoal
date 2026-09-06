const fs = require("fs");
const R = require("path").resolve(__dirname, "..");

const css = fs.readFileSync(R + "/style.css", "utf8");
const fontes = ["index.html", ...fs.readdirSync(R + "/js").map(f => "js/" + f)]
  .map(f => fs.readFileSync(R + "/" + f, "utf8")).join("\n");

// Classes DEFINIDAS no css (fora de comentários).
const semComentario = css.replace(/\/\*[\s\S]*?\*\//g, "");
const definidas = new Set();
for (const bloco of semComentario.split("}")) {
  const sel = bloco.split("{")[0];
  if (!sel || sel.includes("@")) continue;
  for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) definidas.add(m[1]);
}

// Classes USADAS: class="..." no html/js, e classList/className no js.
const usadas = new Set();
for (const m of fontes.matchAll(/class\s*=\s*["'`]([^"'`]*)["'`]/g)) {
  // Pedaços com ${...} têm classe montada em tempo de execução; pega o que der.
  for (const c of m[1].split(/[\s${}()?:"'`+]+/)) if (/^[A-Za-z][\w-]*$/.test(c)) usadas.add(c);
}
for (const m of fontes.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*["']([\w- ]+)["']/g)) {
  for (const c of m[1].split(/\s+/)) if (c) usadas.add(c);
}
// Classes montadas em template: class="algo ${x ? "ativo" : ""}"
for (const m of fontes.matchAll(/["']([a-z][\w-]{2,})["']\s*:\s*["']{2}/g)) usadas.add(m[1]);
for (const m of fontes.matchAll(/\?\s*["'] ?([a-z][\w-]{2,})["']/g)) usadas.add(m[1]);

const mortas = [...definidas].filter(c => !usadas.has(c)).sort();
const semRegra = [...usadas].filter(c => !definidas.has(c)).sort();

console.log("Classes no CSS:", definidas.size, "| usadas no código:", usadas.size);
console.log("\n── DEFINIDAS NO CSS E NUNCA USADAS (" + mortas.length + ") ──");
console.log(mortas.join("\n") || "(nenhuma)");
console.log("\n── USADAS SEM REGRA NO CSS (" + semRegra.length + ") ──");
console.log(semRegra.join("\n") || "(nenhuma)");

#!/usr/bin/env node
/* Sobe o VERSAO_APP e sela o versao.json, numa coisa só. Uso:
 *
 *   node ferramentas/subir-versao.js
 *
 * Existe porque eu já esqueci: num commit subi os ?v=N dos arquivos e
 * deixei o VERSAO_APP parado, e aí a tela de Ajustes mostrava a versão
 * anterior enquanto o código era o novo — exatamente a confusão que o
 * VERSAO_APP existe pra evitar.
 *
 * São dois passos que sempre andam juntos (subir o número e copiá-lo pro
 * versao.json), e dois passos que andam juntos viram um.
 */
const fs = require("fs");
const R = require("path").resolve(__dirname, "..");
const CORE = R + "/js/core.js";

const core = fs.readFileSync(CORE, "utf8");
const m = core.match(/const VERSAO_APP = "(\d{4}-\d{2}-\d{2}) · (\d+)";/);
if (!m) { console.error("Não achei o VERSAO_APP no js/core.js"); process.exit(1); }

const d = new Date();
const hoje = d.getFullYear() + "-" +
  String(d.getMonth() + 1).padStart(2, "0") + "-" +
  String(d.getDate()).padStart(2, "0");
const novo = `${hoje} · ${Number(m[2]) + 1}`;

fs.writeFileSync(CORE, core.replace(m[0], `const VERSAO_APP = "${novo}";`));
fs.writeFileSync(R + "/versao.json", JSON.stringify({ versao: novo }) + "\n");
console.log(`${m[1]} · ${m[2]}  →  ${novo}`);

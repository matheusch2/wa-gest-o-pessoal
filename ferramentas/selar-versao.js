#!/usr/bin/env node
/* Gera o versao.json a partir do VERSAO_APP do core.js. Uso:
 *
 *   node ferramentas/selar-versao.js
 *
 * Os dois PRECISAM concordar. O app compara um com o outro pra descobrir
 * que o index.html que o celular serviu é velho; se discordarem por
 * engano, ele recarrega uma vez, vê que continua diferente e avisa por
 * escrito — nada quebra, mas a conferência deixa de servir.
 *
 * Por isso o número tem uma fonte só, o core.js, e este script copia.
 * Escrever o mesmo número em dois lugares à mão é pedir pra esquecer um.
 */
const fs = require("fs");
const R = require("path").resolve(__dirname, "..");

const core = fs.readFileSync(R + "/js/core.js", "utf8");
const m = core.match(/const VERSAO_APP = "([^"]+)";/);
if (!m) { console.error("Não achei o VERSAO_APP no js/core.js"); process.exit(1); }

fs.writeFileSync(R + "/versao.json", JSON.stringify({ versao: m[1] }) + "\n");
console.log("versao.json selado em " + m[1]);

/* Procura o defeito que já apareceu três vezes neste projeto: uma regra
   GENÉRICA (que não nomeia a classe do elemento — ".campo label",
   ".meta-sem strong", ".saldo") vencendo a regra do PRÓPRIO componente por
   especificidade, e mudando uma propriedade que o componente tinha
   definido. O olho não pega isso: a tela só fica "meio errada". */
window.__auditar = function () {
  const especificidade = sel => {
    const s = sel.replace(/\s*[>+~]\s*/g, " ").trim();
    let a = 0, b = 0, c = 0;
    for (const parte of s.split(/\s+/)) {
      a += (parte.match(/#[\w-]+/g) || []).length;
      b += (parte.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)(?!not\b)[\w-]+/g) || []).length;
      c += (parte.match(/(^|[^.#:\[\w-])[a-z]+[\w-]*/gi) || []).length;
    }
    return a * 10000 + b * 100 + c;
  };

  // A regra "é do componente" quando o último pedaço do seletor nomeia uma
  // das classes do elemento. ".escolha-op" é do componente; ".campo label"
  // não é — ela vem de fora e alcança o elemento por tabela.
  const doComponente = (sel, classes) => {
    const ultimo = sel.replace(/\s*[>+~]\s*/g, " ").trim().split(/\s+/).pop();
    return [...classes].some(c => ultimo.includes("." + c));
  };

  const regras = [];
  let ordem = 0;
  for (const folha of document.styleSheets) {
    let lista; try { lista = folha.cssRules; } catch (e) { continue; }
    const juntar = ls => {
      for (const r of ls) {
        if (r.cssRules && !r.selectorText) { juntar(r.cssRules); continue; }
        if (!r.selectorText) continue;
        for (const sel of r.selectorText.split(",").map(s => s.trim())) {
          if (/::?(hover|active|focus|before|after|placeholder|selection|disabled|checked)/.test(sel)) continue;
          regras.push({ sel, estilo: r.style, ordem: ordem++, esp: especificidade(sel) });
        }
      }
    };
    juntar(lista);
  }

  const achados = [];
  for (const el of document.querySelectorAll("#area *, #menu *, .topo *")) {
    const classes = new Set(el.classList);
    if (!classes.size) continue;

    const casam = regras.filter(r => { try { return el.matches(r.sel); } catch (e) { return false; } });
    if (casam.length < 2) continue;

    const props = new Set();
    for (const r of casam) for (const p of r.estilo) props.add(p);

    for (const prop of props) {
      const quemDeclara = casam.filter(r => r.estilo.getPropertyValue(prop) !== "");
      if (quemDeclara.length < 2) continue;

      quemDeclara.sort((x, y) => {
        const ix = x.estilo.getPropertyPriority(prop) === "important" ? 1 : 0;
        const iy = y.estilo.getPropertyPriority(prop) === "important" ? 1 : 0;
        return ix - iy || x.esp - y.esp || x.ordem - y.ordem;
      });
      const ganhou = quemDeclara[quemDeclara.length - 1];
      if (doComponente(ganhou.sel, classes)) continue;          // o dono venceu: ok

      const perdedorDono = quemDeclara.find(r => doComponente(r.sel, classes));
      if (!perdedorDono) continue;                              // ninguém do componente disputava

      // Mesmo valor nos dois? Então não há conflito de verdade.
      if (ganhou.estilo.getPropertyValue(prop).trim() === perdedorDono.estilo.getPropertyValue(prop).trim()) continue;

      achados.push({
        elemento: el.tagName.toLowerCase() + "." + [...classes].join("."),
        prop,
        venceu: ganhou.sel + "  →  " + ganhou.estilo.getPropertyValue(prop),
        perdeu: perdedorDono.sel + "  →  " + perdedorDono.estilo.getPropertyValue(prop),
      });
    }
  }

  // Um achado por (elemento-classe, prop, par de seletores).
  const vistos = new Set();
  return achados.filter(a => {
    const k = a.elemento + "|" + a.prop + "|" + a.venceu + "|" + a.perdeu;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
};

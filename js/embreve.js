/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: telas ainda por construir.
 *
 * O botão existe antes da tela. Em vez de deixá-lo sem reação — o que a
 * pessoa lê como app quebrado —, ele abre um aviso dizendo o que vem ali.
 * Quando a tela de verdade for feita, é só trocar a função correspondente,
 * e ela some daqui.
 *
 * Cartão e Metas de gastos já saíram: viraram js/cartoes.js e js/metas.js.
 * Faltam Meu plano (em Ajustes) e Relatórios (no menu).
 */

function _telaEmBreve(caption, titulo, icone, texto) {
  document.getElementById("area").innerHTML = `
    <section class="lancamento-tela" style="--cor-tipo:var(--marca-txt)">
      <div class="lancamento-cabecalho">
        <span class="lancamento-cabecalho-icone">${icone}</span>
        <span class="lancamento-caption">${caption}</span>
        <h2>${titulo}</h2>
      </div>

      <div class="bloco">
        <p class="em-breve-txt">${texto}</p>
        <p class="em-breve-selo">Em construção</p>
      </div>

      <!-- voltarTela(), e não voltarInicio(): Relatórios se abre pelo menu,
           mas Meu plano se abre de dentro de Ajustes. Voltar tem que
           devolver pra de onde a pessoa veio, não sempre pro menu. -->
      <button class="botao-fraco" onclick="voltarTela()">Voltar</button>
    </section>`;
}

const _ICO_ESTRELA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3-5.5-3-5.5 3 1-6.3L3 8.9 9 8z"/></svg>`;
const _ICO_BARRAS = `<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="13"/><line x1="22" y1="20" x2="22" y2="7"/></svg>`;

function abrirMeuPlano() {
  abrirTela(() => _telaEmBreve("Assinatura", "Meu plano", _ICO_ESTRELA,
    "Aqui ficam os dados do seu plano e as opções de assinatura."));
}

function abrirRelatorios() {
  abrirTela(() => _telaEmBreve("Análise", "Relatórios e projeções", _ICO_BARRAS,
    "Aqui vão ficar os relatórios do seu dinheiro e as projeções: para onde " +
    "o mês está indo, como os meses se comparam, e o que dá pra esperar dos " +
    "próximos com base no que já aconteceu."));
}

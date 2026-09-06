/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: telas ainda por construir.
 *
 * Os botões de Cartão, Metas de gastos e Meu plano já existem no menu, mas
 * as telas não. Em vez de deixá-los sem reação — o que a pessoa lê como app
 * quebrado —, cada um abre um aviso dizendo o que vem ali. Quando a tela de
 * verdade for feita, é só trocar a função correspondente.
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

      <button class="botao-fraco" onclick="voltarInicio()">Voltar</button>
    </section>`;
}

const _ICO_ESTRELA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3-5.5-3-5.5 3 1-6.3L3 8.9 9 8z"/></svg>`;

/* Cartão e Metas agora têm tela de verdade: js/cartoes.js e js/metas.js */

function abrirMeuPlano() {
  abrirTela(() => _telaEmBreve("Assinatura", "Meu plano", _ICO_ESTRELA,
    "Aqui ficam os dados do seu plano e as opções de assinatura."));
}

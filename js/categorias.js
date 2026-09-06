/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: escolher categoria, e criar uma sem sair da tela.
 */

/* ═══ CRIAR CATEGORIA DE DENTRO DO CAMPO ══════════════════════════════
   Criar categoria só existia em Ajustes → Categorias. Quem estava
   preenchendo uma meta e não achava "Energia" tinha que abandonar o
   formulário, ir em Ajustes, criar, voltar e recomeçar. Na prática
   ninguém faz isso: joga tudo em "Casa" e pronto — e aí a meta de Casa
   mistura aluguel, energia, internet e água, que é justamente o que ela
   não deveria fazer.

   Então a lista de categorias ganhou uma última opção: "+ Nova
   categoria". Escolhendo ela, um campinho abre logo abaixo, sem sair da
   tela nem perder o que já foi digitado.

   O select NUNCA fica valendo "__nova": escolher essa opção devolve o
   select pro valor anterior na mesma hora e só então abre o campo. Sem
   isso, salvar com ela selecionada gravaria um lançamento na categoria
   "__nova" — um valor de controle vazando pra dentro dos dados. */

const CATEGORIA_NOVA = "__nova";

// Monta o <select> com a opção de criar no fim, mais o campinho escondido.
// `aoTrocar` é o NOME de uma função sem argumentos (a prévia da tela, por
// exemplo), chamada toda vez que a escolha muda.
function campoDeCategoria({ id, tipo, opcoes, escolhida, aoTrocar }) {
  const depois = aoTrocar ? `'${aoTrocar}'` : "null";
  const lista = opcoes.length
    ? opcoes.map(n => `<option value="${esc(n)}"${n === escolhida ? " selected" : ""}>${esc(n)}</option>`).join("")
    : "";

  return `
    <select id="${id}" data-anterior="${esc(escolhida || opcoes[0] || "")}"
            onchange="aoEscolherCategoria('${id}', '${tipo}', ${depois})">
      ${lista}
      <option value="${CATEGORIA_NOVA}">+ Nova categoria</option>
    </select>
    <div class="cat-nova" id="${id}-nova" hidden>
      <input type="text" id="${id}-nome" placeholder="Ex: Energia" autocomplete="off"
             onkeydown="if (event.key === 'Enter') { event.preventDefault(); this.nextElementSibling.click(); }">
      <button type="button" class="cat-nova-criar"
              onclick="criarCategoriaNoCampo(this, '${id}', '${tipo}', ${depois})">Criar</button>
      <button type="button" class="cat-nova-fechar" aria-label="Cancelar"
              onclick="fecharNovaCategoria('${id}')">✕</button>
    </div>`;
}

function aoEscolherCategoria(id, tipo, aoTrocar) {
  const sel = document.getElementById(id);
  const linha = document.getElementById(id + "-nova");
  if (!sel || !linha) return;

  if (sel.value === CATEGORIA_NOVA) {
    // Devolve a escolha anterior ANTES de abrir o campo: se a pessoa
    // desistir e salvar, salva o que estava, não o valor de controle.
    sel.value = sel.dataset.anterior || sel.options[0]?.value || "";
    linha.hidden = false;
    document.getElementById(id + "-nome")?.focus();
    return;
  }

  sel.dataset.anterior = sel.value;
  linha.hidden = true;
  if (aoTrocar) window[aoTrocar]?.();
}

function fecharNovaCategoria(id) {
  const linha = document.getElementById(id + "-nova");
  if (!linha) return;
  linha.hidden = true;
  const campo = document.getElementById(id + "-nome");
  if (campo) campo.value = "";
}

async function criarCategoriaNoCampo(botao, id, tipo, aoTrocar) {
  if (botao?.disabled) return;
  const sel = document.getElementById(id);
  const campo = document.getElementById(id + "-nome");
  const nome = (campo?.value || "").trim();

  if (!nome) { erro("Escreva o nome da categoria."); campo?.focus(); return; }

  const solta = travar(botao, "...");
  const { data, error } = await sb.from("categorias")
    .insert({ user_id: usuario.id, nome, tipo }).select().single();

  if (error) {
    solta();
    // Já existe: pode ser que ela só não estivesse NESTA lista (uma meta
    // já usa essa categoria, por exemplo). Dizer "já existe" é a resposta
    // certa e evita a pessoa achar que criou.
    erro(error.code === "23505" ? "Essa categoria já existe." : "Erro: " + error.message);
    return;
  }

  categorias.push(data);
  categorias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // A opção nova entra ANTES do "+ Nova categoria", e já selecionada. O
  // resto da lista fica como estava — cada tela filtra a sua (as Metas
  // escondem categoria que já tem meta), e refazer tudo desfaria isso.
  const opcao = document.createElement("option");
  opcao.value = nome;
  opcao.textContent = nome;
  sel.insertBefore(opcao, sel.querySelector(`option[value="${CATEGORIA_NOVA}"]`));
  sel.value = nome;
  sel.dataset.anterior = nome;

  fecharNovaCategoria(id);
  ok(`Categoria "${nome}" criada.`);
  if (aoTrocar) window[aoTrocar]?.();
}

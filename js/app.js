/*!
 * WA FINANÇAS — Copyright © 2026 Matheus. Todos os direitos reservados.
 * Módulo: inicialização.
 */

/* ═══ PARTIDA ═════════════════════════════════════════════════════════ */

// Descobre se a chave colada é a SECRETA. Não dá para adivinhar pelo tamanho
// nem pelo começo: a chave nova secreta começa com "sb_secret_", e as antigas
// são JWT, onde o papel ("role") está escrito no meio, em base64. Então o jeito
// certo é abrir o crachá e ler.
function ehChaveSecreta(chave) {
  const k = String(chave || "");
  if (k.startsWith("sb_secret_")) return true;
  const partes = k.split(".");
  if (partes.length !== 3) return false;
  try {
    const corpo = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
    return corpo.role === "service_role";
  } catch (e) { return false; }
}

// Recebe o usuário quando quem chamou já o tem em mãos — e quem chama
// sempre tem, porque toda entrada no app passa por um getSession ou por um
// login, e os dois já devolvem o usuário junto. Sem isso, abrir o app
// custava uma ida e volta INTEIRA ao servidor (o getUser) antes da primeira
// consulta sequer começar. Em 4G ruim é o dobro do tempo de espera.
async function iniciarSessao(userConhecido) {
  const user = userConhecido || (await sb.auth.getUser()).data.user;
  if (!user) { telaLogin("entrar"); return; }
  usuario = user;

  document.getElementById("area-login").style.display = "none";
  document.getElementById("area-login").innerHTML = "";
  document.getElementById("topo").style.display = "block";

  const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "?";
  document.getElementById("iniciais").textContent =
    nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  mesAtual = mesDe(_hojeLocal());
  telaCarregando();
  if (!(await carregarTudo())) { telaSemDados(); return; }
  voltarInicio();
  history.pushState({ f: 1 }, "");
}

function telaCarregando() {
  document.getElementById("menu").style.display = "none";
  document.getElementById("area").innerHTML = `
    <div class="carregando">
      <div class="carregando-roda" aria-hidden="true"></div>
      <p>Carregando seus dados...</p>
    </div>`;
}

// Antes, falhar o carregamento só piscava um aviso de três segundos e o menu
// abria com tudo zerado. Dava pra jurar que os lançamentos tinham sumido —
// e nesse susto a pessoa lança tudo de novo, agora em duplicata de verdade.
function telaSemDados() {
  document.getElementById("menu").style.display = "none";
  document.getElementById("area").innerHTML = `
    <div class="bloco" style="text-align:center;margin-top:20px">
      <div class="carregando-erro" aria-hidden="true">📡</div>
      <h2 style="margin:0 0 8px;font-size:16px">Não deu pra carregar seus dados</h2>
      <p style="font-size:13.5px;color:var(--fraco);margin:0 0 16px">
        Seus lançamentos estão salvos e intactos — foi só a conexão que não
        respondeu agora. Confira a internet e tente de novo.
      </p>
      <button class="botao" onclick="recarregarDados(this)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>
        Tentar de novo
      </button>
      <button class="botao-fraco" onclick="sair()">Sair da conta</button>
    </div>`;
}

async function recarregarDados(botao) {
  travar(botao, "Carregando...");
  // Falhando de novo, redesenha a tela de falha em vez de só destravar o
  // botão: assim a função serve tanto pra quem já está nela quanto pra quem
  // chegou aqui da tela de carregamento.
  if (!(await carregarTudo())) { telaSemDados(); return; }
  voltarInicio();
  history.pushState({ f: 1 }, "");
}

document.addEventListener("DOMContentLoaded", async () => {
  lembrarTema();
  aplicarTema();
  // Quem escolheu "igual ao celular" acompanha a troca sem recarregar.
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", aplicarTema);

  // A chave secreta ignora o RLS: quem a tiver lê e apaga os dados de todo
  // mundo. Colar a errada é um engano de dois segundos com estrago permanente,
  // e não dá nenhum sinal — o app funcionaria igualzinho. Por isso ele para.
  if (ehChaveSecreta(SUPABASE_KEY)) {
    document.getElementById("area-login").innerHTML = `
      <div class="login">
        <div class="login-topo"><div class="moeda">🛑</div><h2 style="color:#dc2626">Chave errada</h2></div>
        <p style="font-size:13.5px;color:var(--fraco)">
          A chave no <b>index.html</b> é a <b>secreta</b> (service_role). Ela ignora
          toda a proteção do banco — publicada num site, dá acesso aos seus dados
          a qualquer pessoa.<br><br>
          Troque pela chave <b>publicável</b> (ou "anon public"), em
          Project Settings → API. E, se essa chave secreta já esteve na internet,
          gere uma nova no Supabase.
        </p>
      </div>`;
    return;
  }

  if (SUPABASE_URL.includes("SEUPROJETO") || SUPABASE_KEY.includes("COLE_AQUI")) {
    document.getElementById("area-login").innerHTML = `
      <div class="login">
        <div class="login-topo"><div class="moeda">⚙️</div><h2>Falta configurar</h2></div>
        <p style="font-size:13.5px;color:var(--fraco)">
          Abra o <b>index.html</b> e troque as duas linhas marcadas com
          "TROQUE AQUI" pela URL e pela chave publicável do seu projeto no
          Supabase. Depois rode o <b>banco.sql</b> no SQL Editor.
        </p>
      </div>`;
    return;
  }

  // O link de "esqueci minha senha" chega com o token depois do "#".
  sb.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") telaLogin("nova");
  });

  const { data: { session } } = await sb.auth.getSession();
  if ((window.location.hash || "").includes("type=recovery")) { telaLogin("nova"); return; }
  if (session) await iniciarSessao(session.user);
  else telaLogin("entrar");
});

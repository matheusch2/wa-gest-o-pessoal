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
  const relogio = ehErroDeCracha(ultimoErroCarga?.message);

  document.getElementById("menu").style.display = "none";
  document.getElementById("area").innerHTML = `
    <div class="bloco" style="text-align:center;margin-top:20px">
      <div class="carregando-erro" aria-hidden="true">${relogio ? "🕐" : "📡"}</div>
      <h2 style="margin:0 0 8px;font-size:16px">${relogio
        ? "O relógio deste aparelho está fora da hora"
        : "Não deu pra carregar seus dados"}</h2>
      <p style="font-size:13.5px;color:var(--fraco);margin:0 0 4px">${relogio
        ? `O servidor recusa a sua entrada quando a hora do aparelho não bate
           com a dele. Seus dados estão salvos e intactos.`
        : `Seus lançamentos estão salvos e intactos — foi só a conexão que não
           respondeu agora. Confira a internet e tente de novo.`}</p>

      <p class="relogio-medida" id="relogio-medida"></p>

      ${relogio ? `
        <p style="font-size:13px;color:var(--texto);text-align:left;margin:0 0 16px;line-height:1.6">
          <b>Como resolver:</b><br>
          Ajustes do celular → <b>Data e hora</b> → ligue
          <b>"Definir automaticamente"</b>. Depois volte aqui e toque em
          Tentar de novo.
        </p>` : ""}

      <button class="botao" onclick="recarregarDados(this)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>
        Tentar de novo
      </button>
      <button class="botao-fraco" onclick="sair()">Sair e entrar de novo</button>
    </div>`;

  // A medição vai pra tela depois, sozinha: ela custa uma ida ao servidor, e
  // segurar a tela por causa dela seria deixar a pessoa esperando de novo.
  if (relogio) mostrarMedidaDoRelogio();
}

async function mostrarMedidaDoRelogio() {
  const desvio = await medirRelogio();
  const alvo = document.getElementById("relogio-medida");
  if (!alvo || desvio === null) return;

  // O cabeçalho do servidor tem precisão de 1 segundo, e a rede acrescenta
  // o seu tanto. Abaixo de meio minuto não é desvio, é ruído de medição.
  if (Math.abs(desvio) < 30) {
    alvo.textContent = "O relógio deste aparelho está certo. Toque em Sair e entrar de novo.";
    return;
  }

  const min = Math.round(Math.abs(desvio) / 60);
  const quanto = min >= 60
    ? Math.floor(min / 60) + "h" + String(min % 60).padStart(2, "0")
    : min >= 1 ? min + (min > 1 ? " minutos" : " minuto")
    : Math.abs(desvio) + " segundos";

  alvo.innerHTML = `Ele está <b>${quanto} ${desvio > 0 ? "adiantado" : "atrasado"}</b>
    em relação ao servidor.`;
  alvo.classList.add("forte");
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

const fs = require("fs");
const R = require("path").resolve(__dirname, "..");

let html = fs.readFileSync(R + "/index.html", "utf8");
html = html.replace(/<script defer src="https:\/\/cdn\.jsdelivr[^"]*supabase[^"]*"><\/script>/g, "");

// O CSS entra EMBUTIDO: em file:// o navegador recusa ler as regras de uma
// folha externa, e sem ler as regras não há auditoria. Embutir não muda
// ordem nem especificidade, então o que se mede aqui vale pra produção.
html = html.replace(/<link rel="stylesheet" href="style\.css[^"]*">/,
  "<style>\n" + fs.readFileSync(R + "/style.css", "utf8") + "\n</style>");
html = html.replace(/style="display:none"/g, "");
html = html.replace(/<script>\s*\/\* ══ TROQUE AQUI[\s\S]*?<\/script>/, `
<script>
  const supabase = { createClient: () => ({ from: () => ({}) }) };
  const SUPABASE_URL = "x", SUPABASE_KEY = "x";
</script>`);

const DADOS = `
<script>
document.addEventListener("DOMContentLoaded", () => {
  usuario = { id:"u1", email:"m@x.com", user_metadata:{ nome:"Matheus Vitalo" } };
  mesAtual = "2026-09";
  categorias = ["Mercado","Casa","Transporte","Saúde","Lazer","Outros"].map((n,i)=>({id:"g"+i,nome:n,tipo:"saida"}))
    .concat(["Salário","Vendas"].map((n,i)=>({id:"e"+i,nome:n,tipo:"entrada"})));
  lancamentos = [
    { id:"e1", tipo:"entrada", valor:2000, data:"2026-09-01", categoria:"Salário", descricao:"Salário" },
    { id:"s1", tipo:"saida", valor:640, data:"2026-09-03", categoria:"Mercado", descricao:"Feira do mês" },
    { id:"s2", tipo:"saida", valor:1200, data:"2026-09-05", categoria:"Casa", descricao:"Aluguel" },
    { id:"a1", tipo:"entrada", valor:2000, data:"2026-08-01", categoria:"Salário", descricao:"Salário" },
    { id:"a2", tipo:"saida", valor:543, data:"2026-08-10", categoria:"Mercado", descricao:"Feira" },
  ];
  contas = [
    { id:"c1", nome:"Luz", valor:180, vencimento:"2026-09-20", pago:false, categoria:"Casa", recorrente:true },
    { id:"c2", nome:"Internet", valor:120, vencimento:"2026-08-15", pago:false, categoria:"Casa" },
    { id:"c3", nome:"Água", valor:70, vencimento:"2026-09-08", pago:true, categoria:"Casa", pago_em:"2026-09-07" },
  ];
  cartoes = [{ id:"k1", nome:"Nubank principal", banco:"nubank", dia_fechamento:1, dia_vencimento:10 }];
  comprasCartao = [
    { id:"p1", cartao_id:"k1", descricao:"Tênis de corrida", valor:1200, parcelas:6, data:"2026-09-14", categoria:"Lazer" },
    { id:"p2", cartao_id:"k1", descricao:"Mercado", valor:187.9, parcelas:1, data:"2026-09-20", categoria:"Mercado" },
  ];
  pagamentosFatura = [
    { id:"pf1", cartao_id:"k1", mes_ref:"2026-10", tipo:"pago", valor:100, pago_em:"2026-09-06", lancamento_id:null, compra_id:null },
  ];
  metas = [
    { id:"m1", categoria:"Mercado", valor:800, reservar:true },
    { id:"m2", categoria:"Casa", valor:1400, reservar:true },
    { id:"m3", categoria:"Lazer", valor:300, reservar:false },
  ];
  fechamentos = [];
  document.getElementById("area-login").remove();
  document.getElementById("menu").style.display = "grid";
  window.__pronto = true;
});
</script>`;

fs.writeFileSync(R + "/_audit.html", html.replace("</body>", DADOS + "\n</body>"));
console.log("ok");

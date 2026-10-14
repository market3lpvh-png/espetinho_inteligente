// ============================================================
//  SERVIDOR (Railway) — faz tudo em um lugar só:
//   - serve o PAINEL (/painel.html)
//   - guarda e compartilha o estado no banco de dados (rotas /api)
//   - atende no chat de teste (/chat) — o cérebro do atendente
//   - (futuro) webhook do WhatsApp e impressora
// ============================================================

const express = require("express");
const crypto = require("crypto");
const { pensar, extrairCupom } = require("./cerebro");
const bd = require("./db");

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.send("Sistema no ar ✅ — painel em /painel.html"));
app.use(express.static("public"));

// ------------------------------------------------------------
//  LOGIN — uma senha por função (dono / atendente / motoboy).
//  As senhas ficam em variáveis de ambiente na Railway. Troque-as lá!
// ------------------------------------------------------------
const SENHAS = {
  dono: process.env.SENHA_DONO || "dono123",
  atendente: process.env.SENHA_ATENDENTE || "atendente123",
  motoboy: process.env.SENHA_MOTOBOY || "motoboy123",
};
const SECRET = process.env.SESSION_SECRET || ("sq-" + SENHAS.dono + SENHAS.atendente);
function tokenPara(role) {
  const sig = crypto.createHmac("sha256", SECRET).update(role).digest("hex").slice(0, 24);
  return role + "." + sig;
}
function roleDoToken(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
  const role = token.split(".")[0];
  return SENHAS[role] && tokenPara(role) === token ? role : null;
}
function papelDaReq(req) {
  return roleDoToken(req.headers["x-token"] || (req.body && req.body._token) || req.query._token);
}
// Middleware: exige login e, se passar funções, exige uma delas.
function exigir(...roles) {
  return (req, res, next) => {
    const p = papelDaReq(req);
    if (!p) return res.status(401).json({ erro: "faça login" });
    if (roles.length && !roles.includes(p)) return res.status(403).json({ erro: "sem permissão para isso" });
    req.papel = p;
    next();
  };
}

app.post("/api/login", (req, res) => {
  const senha = String((req.body || {}).senha || "");
  const role = Object.keys(SENHAS).find((r) => SENHAS[r] && senha === SENHAS[r]);
  if (!role) return res.status(401).json({ erro: "senha incorreta" });
  res.json({ role, token: tokenPara(role) });
});

// ------------------------------------------------------------
//  API DO PAINEL
//  O painel lê o estado com GET /api/estado e, a cada ação,
//  faz um POST e volta a ler. Assim todos os aparelhos ficam iguais.
// ------------------------------------------------------------
function dataPedido(req) {
  const d = (req.query.data || (req.body && req.body.data) || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : bd.hojeData();
}
function responderEstado(res, data) {
  res.json(bd.estadoDoDia(data));
}

// Estado completo do dia
app.get("/api/estado", exigir("dono", "atendente", "motoboy"), (req, res) => {
  try { responderEstado(res, dataPedido(req)); }
  catch (e) { res.status(500).json({ erro: String(e.message || e) }); }
});

// Lançar item numa mesa/balcão
app.post("/api/mesa/item", exigir("dono", "atendente"), (req, res) => {
  try {
    const data = dataPedido(req);
    const { alvo, key, tipo, acomp } = req.body || {};
    bd.addItemMesa(data, alvo, key, tipo, acomp);
    responderEstado(res, data);
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Remover item da comanda (por posição)
app.post("/api/mesa/remove", exigir("dono", "atendente"), (req, res) => {
  try {
    const data = dataPedido(req);
    const { alvo, idx } = req.body || {};
    bd.removeItemMesa(data, alvo, Number(idx));
    responderEstado(res, data);
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Fechar comanda com forma de pagamento
app.post("/api/mesa/fechar", exigir("dono", "atendente"), (req, res) => {
  try {
    const data = dataPedido(req);
    const { alvo, pag, rotulo } = req.body || {};
    const venda = bd.fecharMesa(data, alvo, pag, rotulo || alvo);
    const estado = bd.estadoDoDia(data);
    res.json({ ...estado, confirmacao: venda });
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Ajustar produção de um item
app.post("/api/producao", exigir("dono"), (req, res) => {
  try {
    const data = dataPedido(req);
    const { key, qtd } = req.body || {};
    bd.setProducao(data, key, qtd);
    responderEstado(res, data);
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Cardápio: criar/editar e remover item (depois fica só pro dono, com login)
app.post("/api/menu/salvar", exigir("dono"), (req, res) => {
  try { const data = dataPedido(req); bd.salvarItemMenu(req.body || {}); responderEstado(res, data); }
  catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});
app.post("/api/menu/remover", exigir("dono"), (req, res) => {
  try { const data = dataPedido(req); bd.removerItemMenu((req.body || {}).key); responderEstado(res, data); }
  catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Motoboy marca o pedido como "saiu" ou "entregue"
app.post("/api/pedido/status", exigir("dono", "atendente", "motoboy"), (req, res) => {
  try {
    const data = dataPedido(req);
    const { id, status } = req.body || {};
    bd.setStatusPedido(data, id, status);
    responderEstado(res, data);
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Histórico (últimos N dias) pro painel do dono
app.get("/api/historico", exigir("dono"), (req, res) => {
  try { res.json({ dias: bd.historico(Number(req.query.dias) || 7) }); }
  catch (e) { res.status(500).json({ erro: String(e.message || e) }); }
});

// Abrir / fechar caixa
app.post("/api/caixa/abrir", exigir("dono", "atendente"), (req, res) => {
  try { const data = dataPedido(req); bd.abrirCaixa(data, (req.body || {}).fundo); responderEstado(res, data); }
  catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});
app.post("/api/caixa/fechar", exigir("dono", "atendente"), (req, res) => {
  try { const data = dataPedido(req); const b = req.body || {}; bd.fecharCaixa(data, b.nome, b.contado); responderEstado(res, data); }
  catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// ------------------------------------------------------------
//  CHAT DE TESTE DO ATENDENTE (o cérebro) — já existia
// ------------------------------------------------------------
const conversas = {};
app.post("/chat", async (req, res) => {
  const { cliente = "teste", mensagem } = req.body || {};
  if (!mensagem) return res.status(400).json({ erro: "envie { mensagem }" });
  try {
    conversas[cliente] = conversas[cliente] || [];
    conversas[cliente].push({ role: "user", content: mensagem });
    const resposta = await pensar(conversas[cliente]);
    conversas[cliente].push({ role: "assistant", content: resposta });
    const { textoCliente, cupom, pedido } = extrairCupom(resposta);
    if (cupom) console.log("\n=== CUPOM PRA COZINHA ===\n" + cupom + "\n=========================\n");
    let registrado = null;
    if (pedido) {
      try { registrado = bd.addPedidoZap(bd.hojeData(), pedido); console.log("Pedido registrado no painel:", registrado.id); }
      catch (e) { console.log("Não deu pra registrar o pedido no painel:", e.message); }
    }
    res.json({ resposta: textoCliente, cupom, pedido: registrado ? registrado.id : null });
  } catch (e) { res.status(500).json({ erro: String(e.message || e) }); }
});

// ------------------------------------------------------------
//  A FAZER (próximos sub-passos do backend):
//   - LOGIN por pessoa (hoje o painel usa o seletor "ver como")
//   - WEBHOOK do WhatsApp: pedido vira linha em pedidos_zap e cai no painel
//   - IMPRESSORA: imprimir o cupom na térmica da cozinha
// ------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Sistema rodando na porta " + PORT));

// ============================================================
//  SERVIDOR (Railway) — faz tudo em um lugar só:
//   - serve o PAINEL (/painel.html)
//   - guarda e compartilha o estado no banco de dados (rotas /api)
//   - atende no chat de teste (/chat) — o cérebro do atendente
//   - (futuro) webhook do WhatsApp e impressora
// ============================================================

const express = require("express");
const { pensar, extrairCupom } = require("./cerebro");
const bd = require("./db");

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.send("Sistema no ar ✅ — painel em /painel.html"));
app.use(express.static("public"));

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
app.get("/api/estado", (req, res) => {
  try { responderEstado(res, dataPedido(req)); }
  catch (e) { res.status(500).json({ erro: String(e.message || e) }); }
});

// Lançar item numa mesa/balcão
app.post("/api/mesa/item", (req, res) => {
  try {
    const data = dataPedido(req);
    const { alvo, key, tipo } = req.body || {};
    bd.addItemMesa(data, alvo, key, tipo);
    responderEstado(res, data);
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Remover item da comanda (por posição)
app.post("/api/mesa/remove", (req, res) => {
  try {
    const data = dataPedido(req);
    const { alvo, idx } = req.body || {};
    bd.removeItemMesa(data, alvo, Number(idx));
    responderEstado(res, data);
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Fechar comanda com forma de pagamento
app.post("/api/mesa/fechar", (req, res) => {
  try {
    const data = dataPedido(req);
    const { alvo, pag, rotulo } = req.body || {};
    const venda = bd.fecharMesa(data, alvo, pag, rotulo || alvo);
    const estado = bd.estadoDoDia(data);
    res.json({ ...estado, confirmacao: venda });
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Ajustar produção de um item
app.post("/api/producao", (req, res) => {
  try {
    const data = dataPedido(req);
    const { key, qtd } = req.body || {};
    bd.setProducao(data, key, qtd);
    responderEstado(res, data);
  } catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});

// Histórico (últimos N dias) pro painel do dono
app.get("/api/historico", (req, res) => {
  try { res.json({ dias: bd.historico(Number(req.query.dias) || 7) }); }
  catch (e) { res.status(500).json({ erro: String(e.message || e) }); }
});

// Abrir / fechar caixa
app.post("/api/caixa/abrir", (req, res) => {
  try { const data = dataPedido(req); bd.abrirCaixa(data, (req.body || {}).fundo); responderEstado(res, data); }
  catch (e) { res.status(400).json({ erro: String(e.message || e) }); }
});
app.post("/api/caixa/fechar", (req, res) => {
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
    const { textoCliente, cupom } = extrairCupom(resposta);
    if (cupom) console.log("\n=== CUPOM PRA COZINHA ===\n" + cupom + "\n=========================\n");
    res.json({ resposta: textoCliente, cupom });
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

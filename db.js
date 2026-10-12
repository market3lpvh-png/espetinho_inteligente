// ============================================================
//  BANCO DE DADOS (arquivo JSON) — a "memória compartilhada" do sistema.
//  Guarda produção, mesas abertas, vendas, caixa e pedidos do WhatsApp.
//  Todos os aparelhos leem/gravam aqui, então o que a atendente faz na
//  barraca aparece pro dono em casa.
//
//  Por que arquivo JSON e não um banco "de verdade"? Pro tamanho de uma
//  barraca é robusto de sobra, não precisa de nada pra compilar (não dá
//  aquele "falha de segmentação") e é fácil de manter.
//
//  O arquivo PRECISA ficar num "volume" da Railway (disco que não some
//  quando o app reinicia). O caminho é a variável DB_PATH. Veja o README.
// ============================================================

const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "espetinho.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ---- Cardápio (fonte da verdade dos itens e preços) ----
const ITENS = [
  { key: "carne",     nome: "Carne",             cat: "Espetinhos", s: 10, c: 22 },
  { key: "calabresa", nome: "Calabresa",         cat: "Espetinhos", s: 10, c: 22 },
  { key: "frango",    nome: "Frango",            cat: "Espetinhos", s: 10, c: 22 },
  { key: "toscana",   nome: "Toscana",           cat: "Espetinhos", s: 10, c: 22 },
  { key: "coracao",   nome: "Coração de frango", cat: "Espetinhos", s: 10, c: 22 },
  { key: "queijo",    nome: "Queijo",            cat: "Espetinhos", s: 13, c: 25 },
  { key: "asa",       nome: "Asa de frango",     cat: "Espetinhos", s: 13, c: 25 },
  { key: "baiao",     nome: "Baião",             cat: "Porções",    u: 10 },
  { key: "arroz",     nome: "Arroz",             cat: "Porções",    u: 10 },
  { key: "vinagrete", nome: "Vinagrete",         cat: "Porções",    u: 10 },
  { key: "maionese",  nome: "Maionese",          cat: "Porções",    u: 10 },
  { key: "macaxeira", nome: "Macaxeira",         cat: "Porções",    u: 5  },
  { key: "refri",     nome: "Refri lata",        cat: "Bebidas",    u: 6  },
  { key: "agua",      nome: "Água mineral",      cat: "Bebidas",    u: 4  },
  { key: "aguagas",   nome: "Água com gás",      cat: "Bebidas",    u: 4  },
  { key: "suco",      nome: "Suco",              cat: "Bebidas",    u: 7  },
];
const MAPA = Object.fromEntries(ITENS.map((i) => [i.key, i]));
function temTipo(key) { return MAPA[key] && MAPA[key].u == null; }
function preco(key, tipo) {
  const it = MAPA[key];
  if (!it) return 0;
  if (it.u != null) return it.u;
  return tipo === "c" ? it.c : it.s;
}
function somaItens(itens) { return itens.reduce((a, it) => a + preco(it.key, it.tipo || null), 0); }

// ---- Datas (use TZ=America/Porto_Velho na Railway) ----
function hojeData() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function hhmm() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ---- Carrega o arquivo na memória (uma vez) ----
// Se o arquivo não existir ou não for um JSON válido (ex.: sobrou um banco
// antigo de outro formato), começa do zero sem travar.
let store = { dias: {} };
try {
  const txt = fs.readFileSync(DB_PATH, "utf8");
  const parsed = JSON.parse(txt);
  if (parsed && typeof parsed === "object" && parsed.dias) store = parsed;
} catch (e) {
  store = { dias: {} };
}

// ---- Grava no disco de forma segura (escreve num temporário e troca) ----
function salvar() {
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, DB_PATH);
}

// ---- Garante a estrutura do dia (caixa aberto, produção zerada) ----
function garantirDia(data) {
  if (!store.dias[data]) {
    const producao = {};
    ITENS.forEach((it) => (producao[it.key] = 0));
    store.dias[data] = {
      caixa: { aberto: true, horaAbriu: hhmm(), fechadoPor: null, horaFechou: null },
      producao,
      mesas: {},
      vendas: [],
      pedidosZap: [],
      _seq: 0,
    };
    salvar();
  }
  return store.dias[data];
}

// ---- Leitura: snapshot completo do dia ----
function estadoDoDia(data) {
  const d = garantirDia(data);
  return {
    data,
    caixa: { ...d.caixa },
    producao: { ...d.producao },
    mesas: JSON.parse(JSON.stringify(d.mesas)),
    vendas: d.vendas.map((v) => ({ id: v.id, alvo: v.alvo, itens: v.itens, total: v.total, pag: v.pag, hora: v.hora })),
    pedidosZap: d.pedidosZap.map((p) => ({ id: p.id, tipo: p.tipo, bairro: p.bairro, end: p.end, pag: p.pag, itens: p.itens, taxa: p.taxa, status: p.status, hora: p.hora })),
    vendidos: vendidos(data),
    menu: ITENS,
  };
}

// ---- Estoque: vendidos = mesas abertas + vendas + pedidos zap ----
function vendidos(data) {
  const d = garantirDia(data);
  const v = {};
  ITENS.forEach((i) => (v[i.key] = 0));
  Object.values(d.mesas).forEach((itens) => itens.forEach((it) => (v[it.key] = (v[it.key] || 0) + 1)));
  d.vendas.forEach((s) => s.itens.forEach((it) => (v[it.key] = (v[it.key] || 0) + 1)));
  d.pedidosZap.forEach((p) => p.itens.forEach((it) => (v[it.key] = (v[it.key] || 0) + 1)));
  return v;
}
function restante(data, key) {
  const d = garantirDia(data);
  return (d.producao[key] || 0) - (vendidos(data)[key] || 0);
}
function esgotado(data, key) {
  const d = garantirDia(data);
  return (d.producao[key] || 0) > 0 && restante(data, key) <= 0;
}

// ---- Escritas ----
function addItemMesa(data, alvo, key, tipo) {
  const d = garantirDia(data);
  if (!MAPA[key]) throw new Error("item inexistente");
  if (!alvo) throw new Error("mesa inválida");
  if (esgotado(data, key)) throw new Error("item esgotado");
  if (!d.mesas[alvo]) d.mesas[alvo] = [];
  d.mesas[alvo].push({ key, tipo: temTipo(key) ? (tipo === "c" ? "c" : "s") : null });
  salvar();
  return d.mesas[alvo];
}
function removeItemMesa(data, alvo, idx) {
  const d = garantirDia(data);
  const itens = d.mesas[alvo] || [];
  if (idx >= 0 && idx < itens.length) itens.splice(idx, 1);
  d.mesas[alvo] = itens;
  salvar();
  return itens;
}
function fecharMesa(data, alvo, pag, rotulo) {
  const d = garantirDia(data);
  if (!["Dinheiro", "Cartão", "Pix"].includes(pag)) throw new Error("forma de pagamento inválida");
  const itens = d.mesas[alvo] || [];
  if (!itens.length) throw new Error("comanda vazia");
  const total = somaItens(itens);
  d._seq = (d._seq || 0) + 1;
  d.vendas.push({ id: d._seq, alvo: rotulo || alvo, itens: itens.slice(), total, pag, hora: hhmm(), criado_em: new Date().toISOString() });
  d.mesas[alvo] = [];
  salvar();
  return { alvo: rotulo || alvo, pag, total };
}
function setProducao(data, key, qtd) {
  const d = garantirDia(data);
  if (!MAPA[key]) throw new Error("item inexistente");
  d.producao[key] = Math.max(0, Math.round(Number(qtd) || 0));
  salvar();
  return d.producao[key];
}
function abrirCaixa(data) {
  const d = garantirDia(data);
  d.caixa = { aberto: true, horaAbriu: hhmm(), fechadoPor: null, horaFechou: null };
  salvar();
}
function fecharCaixa(data, nome) {
  const d = garantirDia(data);
  if (!nome || !String(nome).trim()) throw new Error("informe quem está fechando");
  d.caixa.aberto = false;
  d.caixa.fechadoPor = String(nome).trim();
  d.caixa.horaFechou = hhmm();
  salvar();
}

// ---- Histórico dos últimos N dias ----
function faturamentoDia(data) {
  const d = store.dias[data];
  if (!d) return 0;
  const v = d.vendas.reduce((a, s) => a + s.total, 0);
  const z = d.pedidosZap.reduce((a, p) => a + somaItens(p.itens) + (p.taxa || 0), 0);
  return v + z;
}
function historico(ndias) {
  const n = Math.max(1, Math.min(60, ndias || 7));
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const dt = new Date(); dt.setDate(dt.getDate() - k);
    const data = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
    const d = store.dias[data];
    const itens = d ? (d.vendas.reduce((a, s) => a + s.itens.length, 0) + d.pedidosZap.reduce((a, p) => a + p.itens.length, 0)) : 0;
    const entregas = d ? d.pedidosZap.filter((p) => p.tipo === "entrega").length : 0;
    const preparado = d ? Object.values(d.producao).reduce((a, q) => a + q, 0) : 0;
    out.push({ data, faturamento: faturamentoDia(data), itens, entregas, preparado });
  }
  return out;
}

module.exports = {
  ITENS, MAPA, preco, temTipo, somaItens,
  hojeData, estadoDoDia, vendidos, restante, esgotado,
  addItemMesa, removeItemMesa, fecharMesa, setProducao, abrirCaixa, fecharCaixa,
  garantirDia, historico,
};

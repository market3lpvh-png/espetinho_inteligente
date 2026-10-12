// ============================================================
//  BANCO DE DADOS (arquivo JSON) — a "memória compartilhada" do sistema.
//  Guarda o CARDÁPIO (editável pelo dono), produção, mesas, vendas,
//  caixa e pedidos do WhatsApp. Todos os aparelhos leem/gravam aqui.
//
//  Arquivo único, sem nada pra compilar (não dá "falha de segmentação").
//  Fica num volume da Railway (variável DB_PATH). Veja o README.
// ============================================================

const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "espetinho.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ---- Cardápio inicial (só usado na PRIMEIRA vez; depois vive no banco) ----
const CARDAPIO_PADRAO = [
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

// ---- Carrega o arquivo na memória (uma vez) ----
let store = { dias: {}, menu: null };
try {
  const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  if (parsed && typeof parsed === "object" && parsed.dias) store = parsed;
} catch (e) { store = { dias: {}, menu: null }; }
if (!Array.isArray(store.menu)) store.menu = CARDAPIO_PADRAO.map((i) => ({ ...i }));

function salvar() {
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, DB_PATH);
}

// ---- Acesso ao cardápio (agora é dado do banco) ----
function menu() { return store.menu; }
function itemByKey(key) { return store.menu.find((i) => i.key === key); }
function temTipo(key) { const it = itemByKey(key); return !!(it && it.u == null); }
function preco(key, tipo) {
  const it = itemByKey(key);
  if (!it) return 0;
  if (it.u != null) return it.u;
  return tipo === "c" ? it.c : it.s;
}
function somaItens(itens) { return itens.reduce((a, it) => a + preco(it.key, it.tipo || null), 0); }

// slug pra gerar a "chave" interna a partir do nome, sem repetir
function slug(nome) {
  let s = String(nome || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  if (!s) s = "item";
  let base = s, n = 2;
  while (store.menu.some((i) => i.key === s)) { s = base + "_" + n; n++; }
  return s;
}

// Cria ou edita um item do cardápio.
// Campos: { key?, nome, cat, tipo:"espetinho"|"unico", s, c, u }
function salvarItemMenu(dados) {
  const nome = String(dados.nome || "").trim();
  if (!nome) throw new Error("informe o nome do item");
  const cat = String(dados.cat || "Outros").trim() || "Outros";
  const unico = dados.tipo === "unico" || (dados.u != null && dados.s == null && dados.c == null);
  let item;
  if (unico) {
    const u = Math.max(0, Number(dados.u) || 0);
    item = { nome, cat, u };
  } else {
    const s = Math.max(0, Number(dados.s) || 0);
    const c = Math.max(0, Number(dados.c) || 0);
    item = { nome, cat, s, c };
  }
  if (dados.key && itemByKey(dados.key)) {
    const i = store.menu.findIndex((x) => x.key === dados.key);
    store.menu[i] = { key: dados.key, ...item };
  } else {
    store.menu.push({ key: slug(nome), ...item });
  }
  salvar();
  return store.menu;
}
function removerItemMenu(key) {
  store.menu = store.menu.filter((i) => i.key !== key);
  salvar();
  return store.menu;
}

// Texto do cardápio pro atendente (o cérebro lê isto)
function cardapioTexto() {
  const cats = [...new Set(store.menu.map((i) => i.cat))];
  let txt = "";
  cats.forEach((cat) => {
    txt += "\n" + cat.toUpperCase() + ":\n";
    store.menu.filter((i) => i.cat === cat).forEach((i) => {
      if (i.u != null) txt += `- ${i.nome}: R$${i.u},00\n`;
      else txt += `- ${i.nome}: simples R$${i.s},00 | completo R$${i.c},00\n`;
    });
  });
  return txt.trim();
}

// ---- Datas (use TZ=America/Porto_Velho na Railway) ----
function hojeData() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function hhmm() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function garantirDia(data) {
  if (!store.dias[data]) {
    const producao = {};
    menu().forEach((it) => (producao[it.key] = 0));
    store.dias[data] = {
      caixa: { aberto: true, horaAbriu: hhmm(), fechadoPor: null, horaFechou: null, fundoAbertura: 0, valorContado: null },
      producao, mesas: {}, vendas: [], pedidosZap: [], _seq: 0,
    };
    salvar();
  }
  // garante que itens novos do cardápio tenham entrada na produção do dia
  const d = store.dias[data];
  let mudou = false;
  menu().forEach((it) => { if (d.producao[it.key] == null) { d.producao[it.key] = 0; mudou = true; } });
  if (mudou) salvar();
  return d;
}

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
    menu: menu(),
  };
}

function vendidos(data) {
  const d = garantirDia(data);
  const v = {};
  menu().forEach((i) => (v[i.key] = 0));
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

function addItemMesa(data, alvo, key, tipo) {
  const d = garantirDia(data);
  if (!itemByKey(key)) throw new Error("item inexistente");
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
  if (!itemByKey(key)) throw new Error("item inexistente");
  d.producao[key] = Math.max(0, Math.round(Number(qtd) || 0));
  salvar();
  return d.producao[key];
}
function abrirCaixa(data, fundo) {
  const d = garantirDia(data);
  const f = Math.max(0, Number(fundo) || 0);
  d.caixa = { aberto: true, horaAbriu: hhmm(), fechadoPor: null, horaFechou: null, fundoAbertura: f, valorContado: null };
  salvar();
}
function fecharCaixa(data, nome, contado) {
  const d = garantirDia(data);
  if (!nome || !String(nome).trim()) throw new Error("informe quem está fechando");
  d.caixa.aberto = false;
  d.caixa.fechadoPor = String(nome).trim();
  d.caixa.horaFechou = hhmm();
  d.caixa.valorContado = (contado === null || contado === undefined || contado === "") ? null : Math.max(0, Number(contado) || 0);
  salvar();
}

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
  preco, temTipo, somaItens, menu, cardapioTexto,
  salvarItemMenu, removerItemMenu,
  hojeData, estadoDoDia, vendidos, restante, esgotado,
  addItemMesa, removeItemMesa, fecharMesa, setProducao, abrirCaixa, fecharCaixa,
  garantirDia, historico,
};

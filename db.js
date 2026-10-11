// ============================================================
//  BANCO DE DADOS (SQLite) — a "memória compartilhada" do sistema
//  Guarda produção, mesas abertas, vendas, caixa e pedidos do WhatsApp.
//  Todos os aparelhos leem/gravam aqui, então o que a atendente faz na
//  barraca aparece pro dono em casa.
//
//  É um arquivo único no disco. Na Railway, esse arquivo PRECISA ficar
//  num "volume" (disco que não some quando o app reinicia). O caminho é
//  configurável pela variável DB_PATH. Veja o README.
// ============================================================

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const cfg = require("./loja.config");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "espetinho.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL"); // mais seguro com vários acessos ao mesmo tempo

// ---- Cardápio como fonte da verdade dos itens (vem da config da loja) ----
// Lista de itens derivada do mesmo cardápio que o atendente usa.
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
function somaItens(itens) {
  return itens.reduce((a, it) => a + preco(it.key, it.tipo || null), 0);
}

// ---- Criação das tabelas ----
db.exec(`
CREATE TABLE IF NOT EXISTS estado_dia (
  data TEXT PRIMARY KEY,
  caixa_aberto INTEGER NOT NULL DEFAULT 1,
  caixa_abriu TEXT,
  caixa_fechado_por TEXT,
  caixa_fechou TEXT
);
CREATE TABLE IF NOT EXISTS producao (
  data TEXT NOT NULL,
  item_key TEXT NOT NULL,
  qtd INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (data, item_key)
);
CREATE TABLE IF NOT EXISTS mesas (
  data TEXT NOT NULL,
  alvo TEXT NOT NULL,          -- 'balcao' ou 'mesa-1'...'mesa-12'
  itens TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (data, alvo)
);
CREATE TABLE IF NOT EXISTS vendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  alvo TEXT NOT NULL,
  itens TEXT NOT NULL,
  total REAL NOT NULL,
  pag TEXT NOT NULL,           -- Dinheiro | Cartão | Pix
  hora TEXT NOT NULL,
  criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pedidos_zap (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL,          -- entrega | retirada
  bairro TEXT,
  endereco TEXT,
  pag TEXT,
  itens TEXT NOT NULL,
  taxa REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'preparo',  -- preparo | saindo | entregue
  hora TEXT NOT NULL
);
`);

// ---- Helpers de data (fuso do servidor; na Railway configure TZ=America/Porto_Velho) ----
function hojeData() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function hhmm() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ---- Garante que o dia existe (cria caixa aberto + produção zerada) ----
function garantirDia(data) {
  const existe = db.prepare("SELECT 1 FROM estado_dia WHERE data=?").get(data);
  if (!existe) {
    db.prepare("INSERT INTO estado_dia (data, caixa_aberto, caixa_abriu) VALUES (?, 1, ?)").run(data, hhmm());
    const ins = db.prepare("INSERT OR IGNORE INTO producao (data, item_key, qtd) VALUES (?, ?, 0)");
    const tx = db.transaction(() => ITENS.forEach((it) => ins.run(data, it.key)));
    tx();
  }
}

// ---- Leitura: snapshot completo do dia (o painel desenha a partir disto) ----
function estadoDoDia(data) {
  garantirDia(data);
  const est = db.prepare("SELECT * FROM estado_dia WHERE data=?").get(data);

  const producao = {};
  db.prepare("SELECT item_key, qtd FROM producao WHERE data=?").all(data).forEach((r) => (producao[r.item_key] = r.qtd));

  const mesas = {};
  db.prepare("SELECT alvo, itens FROM mesas WHERE data=?").all(data).forEach((r) => (mesas[r.alvo] = JSON.parse(r.itens)));

  const vendas = db.prepare("SELECT * FROM vendas WHERE data=? ORDER BY id").all(data)
    .map((v) => ({ id: v.id, alvo: v.alvo, itens: JSON.parse(v.itens), total: v.total, pag: v.pag, hora: v.hora }));

  const pedidosZap = db.prepare("SELECT * FROM pedidos_zap WHERE data=? ORDER BY hora").all(data)
    .map((p) => ({ id: p.id, tipo: p.tipo, bairro: p.bairro, end: p.endereco, pag: p.pag,
                   itens: JSON.parse(p.itens), taxa: p.taxa, status: p.status, hora: p.hora }));

  return {
    data,
    caixa: {
      aberto: !!est.caixa_aberto,
      horaAbriu: est.caixa_abriu,
      fechadoPor: est.caixa_fechado_por,
      horaFechou: est.caixa_fechou,
    },
    producao, mesas, vendas, pedidosZap,
    vendidos: vendidos(data),   // estoque já calculado (mesas + vendas + zap)
    menu: ITENS,                // cardápio com preços/categorias, pro painel desenhar
  };
}

// ---- Vendidos (estoque) = itens em mesas abertas + vendas fechadas + pedidos zap ----
function vendidos(data) {
  const v = {};
  ITENS.forEach((i) => (v[i.key] = 0));
  db.prepare("SELECT itens FROM mesas WHERE data=?").all(data).forEach((r) => JSON.parse(r.itens).forEach((it) => (v[it.key] = (v[it.key] || 0) + 1)));
  db.prepare("SELECT itens FROM vendas WHERE data=?").all(data).forEach((r) => JSON.parse(r.itens).forEach((it) => (v[it.key] = (v[it.key] || 0) + 1)));
  db.prepare("SELECT itens FROM pedidos_zap WHERE data=?").all(data).forEach((r) => JSON.parse(r.itens).forEach((it) => (v[it.key] = (v[it.key] || 0) + 1)));
  return v;
}
function restante(data, key) {
  const p = db.prepare("SELECT qtd FROM producao WHERE data=? AND item_key=?").get(data, key);
  return (p ? p.qtd : 0) - (vendidos(data)[key] || 0);
}
function esgotado(data, key) {
  const p = db.prepare("SELECT qtd FROM producao WHERE data=? AND item_key=?").get(data, key);
  return !!(p && p.qtd > 0 && restante(data, key) <= 0);
}

// ---- Escritas ----
function garantirMesa(data, alvo) {
  db.prepare("INSERT OR IGNORE INTO mesas (data, alvo, itens) VALUES (?, ?, '[]')").run(data, alvo);
}
function addItemMesa(data, alvo, key, tipo) {
  garantirDia(data);
  if (!MAPA[key]) throw new Error("item inexistente");
  if (esgotado(data, key)) throw new Error("item esgotado");
  garantirMesa(data, alvo);
  const row = db.prepare("SELECT itens FROM mesas WHERE data=? AND alvo=?").get(data, alvo);
  const itens = JSON.parse(row.itens);
  itens.push({ key, tipo: temTipo(key) ? (tipo === "c" ? "c" : "s") : null });
  db.prepare("UPDATE mesas SET itens=? WHERE data=? AND alvo=?").run(JSON.stringify(itens), data, alvo);
  return itens;
}
function removeItemMesa(data, alvo, idx) {
  const row = db.prepare("SELECT itens FROM mesas WHERE data=? AND alvo=?").get(data, alvo);
  if (!row) return [];
  const itens = JSON.parse(row.itens);
  if (idx >= 0 && idx < itens.length) itens.splice(idx, 1);
  db.prepare("UPDATE mesas SET itens=? WHERE data=? AND alvo=?").run(JSON.stringify(itens), data, alvo);
  return itens;
}
function fecharMesa(data, alvo, pag, rotulo) {
  garantirDia(data);
  if (!["Dinheiro", "Cartão", "Pix"].includes(pag)) throw new Error("forma de pagamento inválida");
  const row = db.prepare("SELECT itens FROM mesas WHERE data=? AND alvo=?").get(data, alvo);
  const itens = row ? JSON.parse(row.itens) : [];
  if (!itens.length) throw new Error("comanda vazia");
  const total = somaItens(itens);
  db.prepare("INSERT INTO vendas (data, alvo, itens, total, pag, hora, criado_em) VALUES (?,?,?,?,?,?,?)")
    .run(data, rotulo, JSON.stringify(itens), total, pag, hhmm(), new Date().toISOString());
  db.prepare("UPDATE mesas SET itens='[]' WHERE data=? AND alvo=?").run(data, alvo);
  return { alvo: rotulo, pag, total };
}
function setProducao(data, key, qtd) {
  garantirDia(data);
  if (!MAPA[key]) throw new Error("item inexistente");
  const q = Math.max(0, Math.round(Number(qtd) || 0));
  db.prepare("INSERT INTO producao (data, item_key, qtd) VALUES (?,?,?) ON CONFLICT(data,item_key) DO UPDATE SET qtd=?")
    .run(data, key, q, q);
  return q;
}
function abrirCaixa(data) {
  db.prepare("UPDATE estado_dia SET caixa_aberto=1, caixa_abriu=?, caixa_fechado_por=NULL, caixa_fechou=NULL WHERE data=?")
    .run(hhmm(), data);
}
function fecharCaixa(data, nome) {
  if (!nome || !String(nome).trim()) throw new Error("informe quem está fechando");
  db.prepare("UPDATE estado_dia SET caixa_aberto=0, caixa_fechado_por=?, caixa_fechou=? WHERE data=?")
    .run(String(nome).trim(), hhmm(), data);
}

// ---- Histórico: resumo dos últimos N dias (pro painel do dono) ----
function faturamentoDia(data) {
  const v = db.prepare("SELECT COALESCE(SUM(total),0) t FROM vendas WHERE data=?").get(data).t;
  let z = 0;
  db.prepare("SELECT itens, taxa FROM pedidos_zap WHERE data=?").all(data)
    .forEach((p) => { z += somaItens(JSON.parse(p.itens)) + (p.taxa || 0); });
  return v + z;
}
function historico(ndias) {
  const n = Math.max(1, Math.min(60, ndias || 7));
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(); d.setDate(d.getDate() - k);
    const data = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const nVendasItens = db.prepare("SELECT itens FROM vendas WHERE data=?").all(data)
      .reduce((a, r) => a + JSON.parse(r.itens).length, 0);
    const nZapItens = db.prepare("SELECT itens FROM pedidos_zap WHERE data=?").all(data)
      .reduce((a, r) => a + JSON.parse(r.itens).length, 0);
    const entregas = db.prepare("SELECT COUNT(*) c FROM pedidos_zap WHERE data=? AND tipo='entrega'").get(data).c;
    const preparado = db.prepare("SELECT COALESCE(SUM(qtd),0) s FROM producao WHERE data=?").get(data).s;
    out.push({ data, faturamento: faturamentoDia(data), itens: nVendasItens + nZapItens, entregas, preparado });
  }
  return out;
}

module.exports = {
  db, ITENS, MAPA, preco, temTipo, somaItens,
  hojeData, estadoDoDia, vendidos, restante, esgotado,
  addItemMesa, removeItemMesa, fecharMesa, setProducao, abrirCaixa, fecharCaixa,
  garantirDia, historico,
};

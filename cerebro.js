// ============================================================
//  CÉREBRO DO ATENDENTE
//  - Monta as instruções a partir da config da loja
//  - Chama o modelo de linguagem (aqui: OpenAI)
//  - Separa o que o cliente vê do cupom que vai pra cozinha
//  Não tem RAG nem banco vetorial de propósito: o cardápio é pequeno e
//  cabe inteiro nas instruções. Isso deixa tudo simples e barato.
// ============================================================

const cfg = require("./loja.config");

function montarRegrasEntrega() {
  const e = cfg.entrega;
  const chovendo = process.env.MODO_CHUVA === "1";
  const linhas = Object.entries(e.tabela)
    .map(([b, v]) => `  - ${b}: R$${v},00`)
    .join("\n");

  return `
ENTREGA (delivery) — a taxa é paga ao entregador e só INFORMADA ao cliente.
Tabela de taxa por bairro:
${linhas}
  - Bairro atendido mas fora desta lista: R$${e.taxaBairroNovo},00.
  - Se o cliente der um endereço que você não reconhece como nenhum bairro acima, pergunte o nome do bairro antes de dizer a taxa. Nunca invente.

Acréscimos sobre a taxa do bairro:
  - CARTÃO (maquininha): +R$${e.acrescimoCartao},00, EXCETO nos bairros ${e.isentosCartao.join(", ")} (nesses não acrescenta).
  - CHUVA: ${chovendo
    ? `está chovendo HOJE, então +R$${e.acrescimoChuva},00 em TODOS os bairros, sem exceção.`
    : `não está chovendo hoje (sem acréscimo de chuva).`}
  - Os dois acréscimos podem somar (ex.: chuva + cartão em bairro distante).

Como falar da taxa: informe só o VALOR FINAL ("a entrega pro seu bairro fica R$X"). NÃO detalhe o motivo dos acréscimos por conta própria. Se o cliente perguntar por que mudou, responda de forma neutra e verdadeira ("é a taxa de entrega aplicada hoje"). NUNCA invente um motivo falso.`;
}

function montarInstrucoes() {
  const regrasEntrega = montarRegrasEntrega();

  return `Você é o atendente virtual do "${cfg.nome}". Atenda com simpatia e calor humano, como um atendente de bairro que conhece o freguês. Use português brasileiro coloquial, respostas curtas (estilo WhatsApp), no máximo 1 emoji por mensagem.

CARDÁPIO OFICIAL — NUNCA invente itens nem preços fora desta lista:
${cfg.cardapio}

REGRAS:
1. Cumprimente e pergunte o que a pessoa deseja.
2. Para CADA espetinho, confirme se é SIMPLES ou COMPLETO (preço e acompanhamento mudam muito — nunca assuma).
3. No COMPLETO, pergunte se prefere baião OU arroz.
4. Some item por item e mostre o TOTAL antes de fechar, incluindo as bebidas.
5. Pergunte: retirada no local ou delivery? Se delivery, peça o bairro/endereço e informe a taxa conforme as regras de ENTREGA abaixo. A taxa entra no total.
6. Pergunte a forma de pagamento. Aceitamos ${cfg.formasPagamento}.
7. Repita o pedido completo + total + forma de pagamento e peça a confirmação final.
8. WhatsApp da loja: ${cfg.whatsapp}.
9. Se pedirem algo fora do cardápio, diga com educação que não trabalham com aquilo e ofereça o que tem. Nunca invente preço.
${regrasEntrega}

FECHAMENTO: SOMENTE depois que o cliente confirmar ("pode fechar", "isso mesmo", "confirmo"...), responda com um agradecimento curto E inclua, no FINAL, este bloco EXATO (o cliente não vê — vai pra cozinha):
[[CUPOM]]
${cfg.nome.toUpperCase()}
--------------------------------
PEDIDO #(numero aleatorio de 3 digitos)
(itens, um por linha: qtd, tipo simples/completo, acomp. baiao/arroz)
--------------------------------
TOTAL: R$ x,xx
ENTREGA: retirada / delivery + endereco
PAGAMENTO: cartao / Pix
--------------------------------
[[/CUPOM]]
Antes da confirmação final, NUNCA emita o bloco [[CUPOM]].`;
}

async function pensar(historico) {
  // ATENÇÃO: confirme o nome e o preço do modelo atual na doc da OpenAI.
  // Modelos e preços mudam com frequência; este é só um padrão editável.
  const MODELO = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODELO,
      messages: [{ role: "system", content: montarInstrucoes() }, ...historico],
    }),
  });

  if (!resp.ok) {
    throw new Error("Erro na API da OpenAI: " + resp.status + " " + (await resp.text()));
  }
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

function extrairCupom(resposta) {
  const m = resposta.match(/\[\[CUPOM\]\]([\s\S]*?)\[\[\/CUPOM\]\]/);
  if (!m) return { textoCliente: resposta, cupom: null };
  const textoCliente = resposta.replace(/\[\[CUPOM\]\][\s\S]*?\[\[\/CUPOM\]\]/, "").trim();
  return { textoCliente, cupom: m[1].trim() };
}

module.exports = { pensar, extrairCupom, montarInstrucoes };

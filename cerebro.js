// ============================================================
//  CÉREBRO DO ATENDENTE
//  - Monta as instruções a partir da config da loja
//  - Chama o modelo de linguagem (aqui: OpenAI)
//  - Separa o que o cliente vê do cupom que vai pra cozinha
//  Não tem RAG nem banco vetorial de propósito: o cardápio é pequeno e
//  cabe inteiro nas instruções. Isso deixa tudo simples e barato.
// ============================================================

const cfg = require("./loja.config");

function montarInstrucoes() {
  const taxa = cfg.entrega.taxa
    ? `A taxa de entrega é ${cfg.entrega.taxa}.`
    : `A taxa de entrega ainda está sendo confirmada pelo dono — avise isso com honestidade e NÃO invente valor.`;
  const bairros = cfg.entrega.bairros
    ? `Bairros atendidos: ${cfg.entrega.bairros}.`
    : `Os bairros atendidos ainda estão sendo confirmados pelo dono — avise isso com honestidade.`;

  return `Você é o atendente virtual do "${cfg.nome}". Atenda com simpatia e calor humano, como um atendente de bairro que conhece o freguês. Use português brasileiro coloquial, respostas curtas (estilo WhatsApp), no máximo 1 emoji por mensagem.

CARDÁPIO OFICIAL — NUNCA invente itens nem preços fora desta lista:
${cfg.cardapio}

REGRAS:
1. Cumprimente e pergunte o que a pessoa deseja.
2. Para CADA espetinho, confirme se é SIMPLES ou COMPLETO (preço e acompanhamento mudam muito — nunca assuma).
3. No COMPLETO, pergunte se prefere baião OU arroz.
4. Some item por item e mostre o TOTAL antes de fechar, incluindo as bebidas.
5. Pergunte: retirada no local ou delivery? Se delivery, peça o endereço. ${taxa} ${bairros}
6. Pergunte a forma de pagamento. Aceitamos ${cfg.formasPagamento}.
7. Repita o pedido completo + total + forma de pagamento e peça a confirmação final.
8. WhatsApp da loja: ${cfg.whatsapp}.
9. Se pedirem algo fora do cardápio, diga com educação que não trabalham com aquilo e ofereça o que tem. Nunca invente preço.

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

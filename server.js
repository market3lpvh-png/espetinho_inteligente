// ============================================================
//  SERVIDOR (Railway)
//  Por enquanto sobe o cérebro e um endpoint de TESTE (/chat), pra você
//  conversar com o atendente SEM WhatsApp ainda. As partes de WhatsApp e
//  impressora estão marcadas como "A FAZER" — dependem de decisões que a
//  gente ainda não fechou (não estão fingidas, estão honestamente vazias).
// ============================================================

const express = require("express");
const { pensar, extrairCupom } = require("./cerebro");

const app = express();
app.use(express.json());

// Memória simples por cliente (telefone -> histórico da conversa).
// OBS honesta: isto fica na memória do servidor. Se o servidor reiniciar,
// as conversas em andamento se perdem. Pra começar e testar, está de bom tamanho;
// quando for pra valer, a gente troca por algo persistente.
const conversas = {};

app.get("/", (_req, res) => res.send("Atendente no ar ✅ — página de teste em /teste.html"));

// Página de teste no navegador (pasta "public"): abra SEU-ENDERECO/teste.html
// Serve pra você testar sem linha de comando e pra demonstrar pro dono.
app.use(express.static("public"));

// ---- ENDPOINT DE TESTE ----
// Teste assim (depois de subir na Railway ou rodando local):
//   curl -X POST http://localhost:3000/chat -H "Content-Type: application/json" \
//        -d '{"cliente":"meu-teste","mensagem":"boa noite"}'
app.post("/chat", async (req, res) => {
  const { cliente = "teste", mensagem } = req.body || {};
  if (!mensagem) return res.status(400).json({ erro: "envie { mensagem }" });

  try {
    conversas[cliente] = conversas[cliente] || [];
    conversas[cliente].push({ role: "user", content: mensagem });

    const resposta = await pensar(conversas[cliente]);
    conversas[cliente].push({ role: "assistant", content: resposta });

    const { textoCliente, cupom } = extrairCupom(resposta);
    if (cupom) {
      // TODO (impressora): aqui a gente vai chamar imprimir(cupom).
      console.log("\n=== CUPOM PRA COZINHA ===\n" + cupom + "\n=========================\n");
    }
    res.json({ resposta: textoCliente, cupom });
  } catch (e) {
    res.status(500).json({ erro: String(e.message || e) });
  }
});

// ============================================================
//  A FAZER — PRÓXIMOS PASSOS (depois de decidirmos juntos)
// ============================================================
//
//  1) WHATSAPP  ->  app.post("/webhook", ...)
//     Recebe a mensagem do cliente e devolve a resposta do cérebro.
//     O formato exato depende da via escolhida:
//       a) API oficial da Meta (mais seguro, dentro das regras, custo por msg)
//       b) gateway de terceiros (mais rápido/barato, com RISCO de bloqueio)
//     NÃO está implementado de propósito — falta essa decisão.
//
//  2) IMPRESSORA  ->  function imprimir(cupom) { ... }
//     Manda o texto do cupom pra térmica (padrão ESC/POS), pelo aparelho
//     que ficar no local (celular velho / tablet / mini-PC). Depende do
//     equipamento — vamos TESTAR antes de prometer qualquer coisa.

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Atendente rodando na porta " + PORT));

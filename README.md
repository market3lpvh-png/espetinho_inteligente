# Atendente automático — espetinho/lanche (núcleo)

Sistema enxuto e **replicável**: o "cérebro" anota o pedido, soma, confere e gera
o cupom da cozinha. Sem RAG e sem banco vetorial — o cardápio é pequeno e cabe
nas instruções, então fica simples e barato.

## Arquivos

- `loja.config.js` — **o único arquivo que muda de um cliente pro outro.** Nome,
  WhatsApp, cardápio, taxa de entrega, bairros.
- `cerebro.js` — monta as instruções, chama o modelo (OpenAI) e separa a resposta
  do cliente do cupom da cozinha.
- `server.js` — servidor com um endpoint de teste (`/chat`) e os espaços
  marcados pra WhatsApp e impressora (ainda não feitos, de propósito).

## Variáveis de ambiente (configurar na Railway)

- `OPENAI_API_KEY` — sua chave da OpenAI. **Você** cria e cola lá; ela nunca fica no código.
- `OPENAI_MODEL` — nome do modelo. **Confirme na doc da OpenAI o nome e o preço
  atuais** (mudam com frequência). Padrão de partida: `gpt-4o-mini`, mas verifique
  se ainda é o mais barato/capaz.

## Rodar local (pra testar)

```
npm install
OPENAI_API_KEY=suachave npm start
```

Em outra janela:

```
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"cliente":"teste","mensagem":"boa noite, quero 2 espetinhos de carne"}'
```

O cupom da cozinha aparece no log do servidor quando o pedido é confirmado.

## Subir na Railway

Suba esta pasta como um projeto Node. A Railway roda `npm start`. Configure as
variáveis de ambiente acima no painel. (Confira no site da Railway o plano e os
custos atuais — eles mudam; não dá pra garantir valor aqui.)

## Adaptar pra outro amigo

Copie a pasta e edite **somente** o `loja.config.js`. Mais nada.

## Ainda falta (honesto)

1. **Dados do cardápio:** preço das bebidas, taxa de entrega e bairros.
2. **WhatsApp:** decidir entre API oficial da Meta (segura, custo por msg) e
   gateway de terceiros (mais barato, com risco de bloqueio do número). Isso
   define como o `/webhook` vai funcionar.
3. **Impressora:** testar a impressão na térmica (ESC/POS) pelo aparelho do local.
4. **Conferência antes de imprimir:** decidir se imprime 100% sozinho ou se o
   filho dá uma olhada rápida — pra evitar trote/engano gastando comida.

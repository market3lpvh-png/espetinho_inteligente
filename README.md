# Sistema do Churrasquinho do Paraná

Um servidor só (na Railway) faz tudo: serve o **painel**, guarda o estado no
**banco de dados** (compartilhado entre os aparelhos) e roda o **atendente** do
chat. Sem RAG — o cardápio é pequeno e cabe nas instruções.

## Arquivos

- `loja.config.js` — **o único arquivo que muda de um cliente pro outro.** Nome,
  WhatsApp, cardápio, taxas de entrega por bairro.
- `cerebro.js` — monta as instruções do atendente, chama o modelo (OpenAI) e
  separa a resposta do cliente do cupom da cozinha.
- `db.js` — o banco de dados (SQLite): produção, mesas, vendas, caixa, entregas.
- `server.js` — o servidor: serve o painel, a API (`/api/...`) e o chat (`/chat`).
- `public/painel.html` — o painel de espetaria (mesas, caixa, fechamento,
  entregas, histórico), ligado ao banco e sincronizando entre aparelhos.
- `public/teste.html` — página de teste do atendente (chat).

## Variáveis de ambiente (na Railway)

- `OPENAI_API_KEY` — sua chave da OpenAI (nunca vai no código).
- `OPENAI_MODEL` — nome do modelo; confirme o atual na doc da OpenAI.
- `DB_PATH` — **importante:** caminho do arquivo do banco. Aponte para dentro do
  volume (veja abaixo), ex.: `/data/espetinho.db`. Se não configurar, o banco vai
  pra pasta local do app — que a Railway apaga a cada deploy.
- `TZ` — fuso horário, para a data virar certo à meia-noite. Use `America/Porto_Velho`.

## ⚠️ O VOLUME (pra não perder os dados)

SQLite é um arquivo. Na Railway, o disco normal do app é **apagado a cada deploy
ou reinício**. Então o banco PRECISA ficar num **volume** (disco permanente):

1. No serviço, abra **Variables** → adicione `DB_PATH` = `/data/espetinho.db` e
   `TZ` = `America/Porto_Velho`.
2. Abra a aba de **Volumes** (ou "+ New" → Volume) e crie um volume montado em
   `/data`. (O nome exato dos botões muda; procure "Volume" / "Mount path".)
3. Faça um novo deploy. Pronto: o banco vive no volume e sobrevive aos deploys.

Sem esse passo, o sistema funciona, mas perde as vendas/produção a cada reinício.

## Rodar local (pra testar)

```
npm install
OPENAI_API_KEY=suachave npm start
```

- Painel: http://localhost:3000/painel.html
- Teste do atendente: http://localhost:3000/teste.html

## Subir na Railway

Suba esta pasta (via GitHub). A Railway roda `npm start`. **Antes de confiar os
dados**, configure o volume e o `DB_PATH` acima.

## Adaptar pra outro amigo

Copie o projeto e edite **só** o `loja.config.js`.

## Próximos passos (ainda faltam)

1. **Login por pessoa** — hoje o painel usa o seletor "ver como"; o login real
   (atendente / dono / motoboy) entra depois.
2. **WhatsApp** — ligar o atendimento oficial (API da Meta). Quando ligado, o
   pedido do cliente vira uma linha em `pedidos_zap` e cai sozinho no painel; e o
   "saiu para entrega" avisa o cliente. (Hoje a aba Entregas mostra isso vazio,
   esperando a conexão.)
3. **Impressora** — imprimir o cupom na térmica da cozinha (ESC/POS).

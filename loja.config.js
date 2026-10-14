// ============================================================
//  CONFIG DA LOJA
//  É SÓ ESTE ARQUIVO QUE MUDA DE UM CLIENTE PRO OUTRO.
//  Pra adaptar o sistema pra outro espetinho/lanche, edite os campos abaixo
//  e suba de novo. Mais nada precisa ser mexido.
// ============================================================

module.exports = {
  nome: "Churrasquinho do Paraná",
  whatsapp: "(69) 9 8496-0479",
  versiculo: "Tudo posso naquele que me fortalece",
  formasPagamento: "cartão e Pix",

  // ---- ENTREGA ----
  // Endereço da barraca (referência pro motoboy / rota).
  endereco: "Rua Treze de Setembro, 1233 - Areal, Porto Velho-RO, 76804-304",

  entrega: {
    // Taxa por bairro, em reais. A taxa é paga direto ao entregador.
    // Pra adicionar um bairro, é só incluir aqui na lista.
    tabela: {
      "Areal": 8,
      "Mato Grosso": 8,
      "Tucumanzal": 8,
      "Mocambo": 8,
      "Santa Bárbara": 8,
      "Embratel": 12,
      "Três Marias": 15,
      "Flodoaldo Pontes Pinto": 13,
      "Condomínio Santa Bárbara": 10,
      "Residencial Volpi 1": 10,
      "Residencial Volpi 2": 10,
      "Villas do Madeira 1": 12,
      "Villas do Madeira 2": 12,
      "Bosque do Madeira": 15,
      "Cai n'água": 10,
      "Castanheira": 15,
      "Aponiã": 15,
      "Bairro Novo": 25,
    },

    // Taxa para endereço cujo bairro NÃO está na lista acima (não cadastrado).
    // OBS: "Bairro Novo" é um bairro de verdade; se vocês atenderem lá, cadastre-o
    // na lista com a taxa certa. Esta taxa aqui é só o valor para lugares que
    // ainda não estão na tabela.
    taxaNaoListado: 25,

    // +R$2 quando o cliente paga NA MAQUININHA (cartão), menos nestes bairros perto:
    acrescimoCartao: 2,
    isentosCartao: ["Areal", "Mato Grosso", "Tucumanzal", "Mocambo", "Santa Bárbara"],

    // +R$2 em dia de chuva, em TODOS os bairros sem exceção.
    // Ligado/desligado pela variável de ambiente MODO_CHUVA ("1" = chovendo).
    // No sistema completo, isso vira um botão no painel.
    acrescimoChuva: 2,
  },

  // ---- CARDÁPIO (a IA lê este texto; mantenha simples e exato) ----
  cardapio: `
ESPETINHOS SIMPLES (acompanha: farofa)
- Carne R$10,00 | Calabresa R$10,00 | Frango R$10,00 | Toscana R$10,00 | Coração de Frango R$10,00 | Queijo R$13,00 | Asa de Frango R$13,00

ESPETINHOS COMPLETO (acompanha: baião OU arroz, farofa, macaxeira, vinagrete, maionese caseira)
- Carne R$22,00 | Calabresa R$22,00 | Frango R$22,00 | Toscana R$22,00 | Coração de Frango R$22,00 | Queijo R$25,00 | Asa de Frango R$25,00

PORÇÕES
- Baião R$10,00 | Arroz R$10,00 | Vinagrete R$10,00 | Maionese R$10,00 | Macaxeira R$5,00

BEBIDAS
- Refrigerante Lata R$6,00 | Água mineral R$4,00 | Água com gás R$4,00 | Suco R$7,00
`.trim(),
};

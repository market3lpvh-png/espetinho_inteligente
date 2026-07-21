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

  // ---- FALTA CONFIRMAR COM O DONO ----
  // Enquanto estiver null, o atendente avisa com sinceridade que ainda está
  // sendo confirmado, em vez de inventar valor.
  entrega: {
    taxa: null,     // ex.: "R$ 5,00"
    bairros: null,  // ex.: "Centro, Embratel, Nova Porto Velho"
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

// Regras fixas da caixa de e-mail do Forentis (o que vem do .env fica em env.config.ts).

// Dados do escritório que entram em toda assinatura. Linha vazia não aparece.
export const ESCRITORIO_ASSINATURA = {
  nome: 'Darcísio Müller Advogados Associados',
  registro: 'OAB/SC 1.074/2005',
  endereco: '', // ex.: 'Rua ..., nº ... — Centro'
  cidade: 'Matriz - Fraiburgo/SC',
  telefone: '(49) 3246-3138',
  site: '', // ex.: 'www.damadvogados.com.br'
  corPrincipal: '#324067', // azul da assinatura oficial
  // Logo da assinatura em texto (quem não tem imagem). Se o arquivo não existir, sai sem logo.
  logo: 'public/email/logo-dam.png',
};

// Imagens prontas de assinatura (uma por pessoa). O cadastro guarda só o nome do arquivo.
// Tamanho recomendado: 1200 x 300 px (aparece com 600 px de largura no e-mail), até 150 KB.
export const PASTA_IMAGENS_ASSINATURA = 'public/email/assinaturas';
export const LARGURA_IMAGEM_ASSINATURA = 600;

// Id da assinatura usada quando o funcionário não tem uma cadastrada.
export const ASSINATURA_PADRAO_ID = 'padrao';

// Código que vai no assunto ("[DAM-4F7K2Q]"). Ajuda a ligar a resposta ao envio (parte 2).
export const PREFIXO_CODIGO_EMAIL = 'DAM';

// Leitura da caixa de entrada (parte 2)
export const DIAS_INICIAIS_LEITURA = 7; // na primeira leitura, olha só os e-mails dos últimos N dias (ou desde a conversa mais antiga)
export const MAX_DIAS_LEITURA = 60; // nunca volta mais que isso
export const LIMITE_POR_LEITURA = 100; // e-mails processados por vez; o resto fica para a próxima
export const MAX_ANEXO_RECEBIDO_MB = 25; // anexo recebido maior que isso não é guardado (fica registrado)
export const PASTA_ANEXOS_EMAIL = 'emails-anexos'; // dentro da pasta de dados (.dados/)
export const MAX_TEXTO_RECEBIDO = 20000; // caracteres guardados do corpo

// Lembretes na mesma conversa: no máximo N envios, com X dias de intervalo.
export const MAX_ENVIOS_POR_CONVERSA = 3;

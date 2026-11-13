// Assinatura de quem envia pela caixa única. Os dados do escritório vêm de email.config.ts.
export interface AssinaturaEmail {
  id: string;
  nome: string; // como aparece na assinatura e como o funcionário é reconhecido
  cargo: string | null; // ex.: 'Advogado', 'Setor de Revisão'
  oab: string | null; // ex.: 'OAB/SC 00.000'
  telefone: string | null;
  whatsapp: string | null;
  email: string | null; // vazio = e-mail da caixa
  // Imagem pronta da assinatura (arquivo em public/email/assinaturas/). Vazio = assinatura em texto.
  // Os campos acima continuam valendo: viram o texto alternativo e a versão em texto puro do e-mail.
  imagem: string | null;
  ativa: boolean;
  criadaEm: string;
  atualizadaEm: string;
}

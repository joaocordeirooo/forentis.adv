// Uma "conversa" é um pedido feito por e-mail: o primeiro envio, os lembretes e (parte 2) as respostas.

export const STATUS_CONVERSA = [
  'enviado', // saiu e aguarda resposta
  'falhou', // não saiu (ver ultimoErro); pode tentar de novo
  'respondido', // chegou resposta (parte 2)
  'devolvido', // o servidor devolveu: endereço inválido, caixa cheia... (parte 2)
] as const;
export type StatusConversa = (typeof STATUS_CONVERSA)[number];

export const TIPOS_VINCULO = ['solicitacao_empresa', 'solicitacao_cliente', 'avulso'] as const;
export type TipoVinculo = (typeof TIPOS_VINCULO)[number];

// A que o e-mail pertence no Forentis / Lawyertool.
export interface VinculoEmail {
  tipo: TipoVinculo;
  solicitacaoId: string | null;
  tarefaId: number | null;
  processoId: number | null;
  empresa: string | null;
}

export interface AnexoRegistrado {
  nome: string;
  mimeType: string;
  tamanho: number; // bytes
  // Anexo recebido: caminho dentro da pasta de dados (emails-anexos/...). null = não guardado (grande demais).
  arquivo?: string | null;
}

// Que tipo de e-mail chegou.
export type TipoRecebido =
  | 'resposta' // resposta de verdade da empresa/cliente
  | 'automatica' // "resposta automática", "ausente", "férias" (não conta como resposta)
  | 'devolucao'; // o servidor devolveu o envio (endereço inválido, caixa cheia...)

export interface MensagemEmail {
  id: string;
  messageId: string; // <...@damadvogados.com.br> — é por ele que a resposta é reconhecida
  direcao: 'saida' | 'entrada';
  situacao: 'enviada' | 'falhou' | 'devolvida' | 'recebida';
  tipo?: TipoRecebido; // só nas de entrada
  de: string;
  para: string[]; // para onde foi de verdade (no modo teste, o EMAIL_TESTE)
  cc: string[];
  assunto: string;
  texto: string; // corpo sem a assinatura
  anexos: AnexoRegistrado[];
  funcionario: string | null; // quem enviou (saída)
  em: string;
  erro: string | null;
  copiadaEnviados: boolean | null; // cópia na pasta Enviados da caixa
  uid?: number | null; // posição na caixa de entrada (IMAP), nas de entrada
}

export interface ConversaEmail {
  id: string;
  codigo: string; // DAM-4F7K2Q (vai no assunto)
  vinculo: VinculoEmail;
  assunto: string; // assunto original, sem [TESTE] e sem código
  destinatarios: { para: string[]; cc: string[] }; // os de verdade (empresa/cliente)
  modoTeste: boolean;
  status: StatusConversa;
  envios: number; // envios que saíram (primeiro + lembretes)
  mensagens: MensagemEmail[];
  respostasNovas: number; // respostas/devoluções que ninguém conferiu ainda (registros antigos: ausente = 0)
  ultimoErro: string | null;
  ultimoEnvioEm: string | null;
  ultimaRespostaEm: string | null;
  criadaEm: string;
  atualizadaEm: string;
}

export interface AnexoParaEnviar {
  nome: string;
  conteudo: Buffer;
  mimeType?: string;
}

// O que um serviço (ou a API) passa para a caixa enviar.
export interface PedidoEmail {
  para: string[];
  cc?: string[];
  assunto: string;
  texto: string;
  anexos?: AnexoParaEnviar[];
  vinculo: Partial<VinculoEmail> & { tipo: TipoVinculo };
  funcionario: string; // nome de quem conferiu/enviou (escolhe a assinatura)
  conversaId?: string; // informado = lembrete na mesma conversa
}

export interface ResultadoEnvioEmail {
  enviado: boolean;
  motivo: string | null;
  destino: string[];
  conversa: ConversaEmail;
}

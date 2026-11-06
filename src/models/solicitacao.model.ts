import type { Pendencia } from './analise.model';

export type TipoSolicitacao = 'cliente' | 'empresa';

export type StatusSolicitacao =
  | 'aguardando_conferencia' // pronta: o funcionário confere e conclui
  | 'bloqueada' // há impedimentos (ver bloqueios); concluir exige ignorarBloqueios
  | 'concluida' // enviada
  | 'falha_envio' // tentou enviar e falhou; pode tentar de novo
  | 'descartada'
  | 'substituida'; // uma análise mais nova trouxe outras pendências

export const STATUS_ABERTOS: StatusSolicitacao[] = ['aguardando_conferencia', 'bloqueada', 'falha_envio'];

export interface AnexoSolicitacao {
  id: string;
  nomeArquivo: string;
  tipo: string; // ctps_vinculo, procuracao...
  paginas: number[];
  arquivoOrigemId: number;
  arquivoOrigemNome: string | null;
  finalidade: string;
  tamanhoBytes: number;
  incluir: boolean; // o funcionário pode tirar um anexo do envio
}

export interface EventoHistorico {
  em: string;
  evento: string;
  por?: string | null;
  detalhe?: string | null;
}

export interface Solicitacao {
  id: string;
  tipo: TipoSolicitacao;
  status: StatusSolicitacao;
  criadaEm: string;
  atualizadaEm: string;
  execucaoId: string | null;

  tarefaId: number;
  tarefaTitulo: string | null;
  processoId: number;
  clienteNome: string | null;
  responsavel: string | null;

  // Empresa: chave normalizada do nome (usada nas travas e no comentário).
  empresa: string | null;
  empresaChave: string | null;

  assinatura: string;
  modoTeste: boolean;

  destinatario: {
    nome: string | null;
    telefone: string | null; // cliente
    email: string | null; // empresa
  };
  assunto: string | null; // e-mail da empresa
  texto: string; // cliente: {Documentos_Pendentes}; empresa: corpo do e-mail

  resumo: string;
  pendencias: Pendencia[];
  confianca: string | null;
  bloqueios: string[]; // impedem concluir sem ignorarBloqueios
  avisos: string[]; // pontos de conferência que não impedem
  anexos: AnexoSolicitacao[];
  detalhes: Record<string, unknown>; // contatos, análises dos PDFs, avaliação...

  conclusao: null | {
    por: string;
    em: string;
    enviado: boolean;
    destino: string | null;
    motivo: string | null;
    comentarioRegistrado: boolean;
  };
  historico: EventoHistorico[];
}

import type { Pendencia } from './analise.model';

// indefinida = pendências que a IA não conseguiu dizer se são do cliente ou de uma empresa;
// o funcionário classifica cada uma (vira pedido ao cliente, a uma empresa, ou é ignorada).
export type TipoSolicitacao = 'cliente' | 'empresa' | 'indefinida';

// Setor/fluxo/tipo da tarefa no Lawyertool (a visão geral agrupa por setor).
export interface OrigemTarefa {
  setor: { id: number; descricao: string } | null;
  fluxo: { id: number; descricao: string } | null;
  tipoTarefa: { id: number; descricao: string } | null;
}

export interface ClassificacaoPendencia {
  destino: 'cliente' | 'empresa' | 'ignorar';
  empresa: string | null;
  solicitacaoId: string | null; // pedido para onde a pendência foi
  por: string;
  em: string;
}

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
  tipo: string; // ctps_vinculo, procuracao... (anexado pelo funcionário: 'anexo_manual')
  paginas: number[];
  arquivoOrigemId: number | null; // null = anexado pelo funcionário
  origem?: 'recorte' | 'funcionario'; // ausente = recorte (registros antigos)
  mimeType?: string; // ausente = application/pdf
  anexadoPor?: string | null;
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
  origem?: OrigemTarefa; // ausente em solicitações antigas

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
  pendencias: (Pendencia & { classificacao?: ClassificacaoPendencia })[];
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

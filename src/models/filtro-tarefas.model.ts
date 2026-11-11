// Filtro de tarefas (igual ao do Lawyertool): setor, fluxo, responsável, situação e datas.

export const SITUACOES_TAREFA = ['pendente', 'iniciada', 'bloqueada', 'concluida', 'cancelada'] as const;
export type SituacaoTarefa = (typeof SITUACOES_TAREFA)[number];

export interface SetorTarefa {
  id: number;
  descricao: string;
}

export interface FluxoTarefa {
  id: number;
  descricao: string;
  setorId: number | null;
  setorDescricao: string | null;
}

export interface UsuarioLawyertool {
  id: number;
  nome: string;
}

// Opções que alimentam os campos do filtro.
export interface OpcoesFiltroTarefas {
  setores: SetorTarefa[];
  fluxos: FluxoTarefa[];
  usuarios: UsuarioLawyertool[];
  situacoes: readonly SituacaoTarefa[];
  automacoes: AutomacaoTarefa[];
  atualizadoEm: string;
}

// Intervalo de datas (AAAA-MM-DD); qualquer ponta pode ficar vazia.
export interface Intervalo {
  inicio?: string;
  fim?: string;
}

export interface FiltroTarefas {
  setorId?: number;
  fluxoId?: number;
  usuarioId?: number;
  situacoes: SituacaoTarefa[];
  dataInicio: Intervalo;
  dataFinalEsperada: Intervalo;
  dataFinalReal: Intervalo;
  pagina: number;
  porPagina: number;
  todas: boolean; // true = traz todas as tarefas do filtro (até o limite), para filtrar por coluna na tela
}

// Tarefa como vem da listagem filtrada (displayFields da tela de tarefas do Lawyertool).
export interface TarefaFiltrada {
  id: number;
  titulo: string | null;
  situacao: string;
  prioridade?: string | null;
  atrasada?: boolean | null;
  diasAtraso?: number | null;
  destaca?: boolean | null;
  dataInicio?: string | null;
  dataFinalEsperada?: string | null;
  dataFinalReal?: string | null;
  tipoTarefa?: { id: number; descricao?: string } | null;
  setor?: { id: number; descricao?: string } | null;
  fluxo?: { id: number; descricao?: string } | null;
  usuarioResponsavel?: { id: number; nome?: string } | null;
  usuarioSolicitante?: { id: number; nome?: string } | null;
  processo?: { id: number; numeroProcesso?: string | null } | null;
  emitente?: { id: number; nome?: string } | null;
}

// O que o sistema sabe fazer sozinho com as tarefas de um setor/fluxo.
export interface AutomacaoTarefa {
  id: string;
  nome: string;
  descricao: string;
  status: 'ativa' | 'em_preparacao';
  via: 'forentis' | 'n8n'; // onde o trabalho é feito
  motivoInativa?: string; // por que ainda não executa (mostrado na tela)
  setorId: number;
  fluxoIds: number[] | null; // null = qualquer fluxo do setor
  tipoTarefaIds: number[] | null; // null = qualquer tipo
}

export interface ResultadoFiltroTarefas {
  tarefas: (TarefaFiltrada & { automacaoId: string | null })[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  incompleta: boolean; // modo todas: o filtro tem mais tarefas que o limite
  automacoes: AutomacaoTarefa[]; // automações que valem para o setor/fluxo filtrado
}

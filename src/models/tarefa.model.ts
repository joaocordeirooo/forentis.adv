// Campos da tarefa que pedimos ao Lawyertool (displayFields).
export interface Tarefa {
  id: number;
  titulo: string | null;
  situacao: string;
  prioridade?: string | null;
  dataFinalEsperada?: string | null;
  processo?: { id: number; numeroProcesso?: string | null } | null;
  emitente?: { id: number; nome: string } | null;
  usuarioResponsavel?: { nome: string } | null;
  tipoTarefa?: { id: number; descricao: string } | null;
  fluxo?: { id: number; descricao?: string } | null;
}

// O que o service devolve: as tarefas e como foi a busca.
export interface ResultadoBuscaTarefas {
  tarefas: Tarefa[];
  porTipo: { tipoTarefaId: number; descricao: string; quantidade: number; triagem: boolean }[];
  lidasNoLawyertool: number;
  paginasLidas: number;
  buscaIncompleta: boolean;
  atualizadoEm: string;
}

// O que o sistema lembra de cada tarefa entre uma execução e outra.
export interface EstadoTarefa {
  id: string; // id da tarefa no Lawyertool, como texto
  tarefaId: number;
  impressao: string; // "impressão digital" do que havia na tarefa na última análise
  analisadaEm: string;
  decisao: string; // decisão da análise ou da triagem
  tratada: boolean;
  motivos: string[];
  triagem: { envolve: boolean; motivo: string } | null;
  solicitacoes: string[];
}

// Uma rodada da automação (equivale a uma execução do workflow no n8n).

export interface ResultadoTarefa {
  tarefaId: number;
  tarefaTitulo: string | null;
  tipoTarefa: string | null;
  processoId: number | null;
  clienteNome: string | null;
  decisaoAnalise: string;
  resumoAnalise: string;
  tratada: boolean;
  motivos: string[]; // por que não foi tratada (lista nominal, nunca só o número)
  solicitacoes: string[]; // ids das solicitações criadas
  observacoes: string[];
}

export interface Execucao {
  id: string;
  status: 'em_andamento' | 'concluida' | 'falhou';
  iniciadaEm: string;
  finalizadaEm: string | null;
  modoTeste: boolean;
  filtroTarefaId: number | null;
  origem: 'manual' | 'agenda';
  forcar: boolean; // true = reanalisa mesmo as tarefas sem novidade
  tarefasEncontradas: number;
  tarefasProcessadas: number;
  resultados: ResultadoTarefa[];
  erro: string | null;
}

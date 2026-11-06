// Tipos de tarefa do setor Revisão que entram na conferência automática de documentos externos.
// Para incluir um tipo novo, acrescente uma linha aqui (os IDs estão no Lawyertool).
// triagem: true = antes da análise completa, a IA confere rapidamente se a tarefa tem pedido de documento externo.

export interface TipoMonitorado {
  tipoTarefaId: number;
  fluxoId: number;
  descricao: string;
  triagem: boolean;
}

export const SETOR_REVISAO = 2;

export const TIPOS_MONITORADOS: TipoMonitorado[] = [
  { tipoTarefaId: 30, fluxoId: 56, descricao: 'Dar andamento Revisão - Analise RMI', triagem: false },
  { tipoTarefaId: 28, fluxoId: 59, descricao: 'Solicitar Documentos - Material interno', triagem: false },
  { tipoTarefaId: 125, fluxoId: 59, descricao: 'Solicitar documentação atualizada para Ação Judicial - Material interno', triagem: false },
  { tipoTarefaId: 85, fluxoId: 63, descricao: 'Solicitar Documentos - Ação Nova', triagem: false },
  { tipoTarefaId: 58, fluxoId: 59, descricao: 'Complementar provas - Material interno', triagem: false },
  { tipoTarefaId: 126, fluxoId: 59, descricao: 'Exigência INSS - Material Interno', triagem: false },
  { tipoTarefaId: 194, fluxoId: 59, descricao: 'Analisar Revisão - Material Interno', triagem: true },
];

export function tipoMonitorado(tipoTarefaId: number | undefined): TipoMonitorado | undefined {
  return TIPOS_MONITORADOS.find((t) => t.tipoTarefaId === tipoTarefaId);
}

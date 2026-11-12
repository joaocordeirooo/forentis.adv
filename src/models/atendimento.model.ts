// Tarefas que o atendente externo resolve na rua (coletar assinatura, buscar CTPS, entregar concessão...).

export type SituacaoAtendimento = 'pendente' | 'iniciada' | 'concluida';

export interface TarefaAtendimento {
  id: string; // "lt-5222" (Lawyertool) ou "ex-1" (exemplo)
  tarefaId: number | null; // id no Lawyertool; null nos exemplos
  exemplo: boolean; // true = criada para teste, não existe no Lawyertool
  atendenteId: string;
  setor: string;
  tipo: string;
  titulo: string;
  descricao: string; // o que coletar/entregar
  cliente: string;
  cidade: string | null;
  processo: string | null;
  prazo: string; // AAAA-MM-DD
  situacao: SituacaoAtendimento;
  iniciadaEm: string | null;
  iniciadaPor: string | null;
  concluidaEm?: string | null; // data final real (tarefas do Lawyertool)
  tarefaFinal?: boolean | null; // tipo "tarefa final": pode concluir sem criar próxima tarefa (false = só pelo Lawyertool)
}

export interface Atendente {
  id: string; // "teste" (fictício) ou "u-115" (usuário 115 do Lawyertool)
  nome: string;
  ficticio: boolean;
  usuarioId?: number | null; // id do usuário no Lawyertool
  liberado?: boolean; // pode iniciar/concluir no Lawyertool (fase de teste: só os liberados no .env)
  abertas?: number; // pendentes + iniciadas no período
}

export interface ResultadoMaterialColetado {
  id: string;
  titulo: string;
  cliente: string;
  ok: boolean;
  simulado: boolean; // true = exemplo ou modo sem gravação no Lawyertool
  mensagem: string;
}

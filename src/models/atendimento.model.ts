// Tarefas que o atendente externo resolve na rua (coletar assinatura, buscar CTPS, entregar concessão...).

export type SituacaoAtendimento = 'pendente' | 'iniciada';

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
}

export interface Atendente {
  id: string;
  nome: string;
  ficticio: boolean;
}

export interface ResultadoMaterialColetado {
  id: string;
  titulo: string;
  cliente: string;
  ok: boolean;
  simulado: boolean; // true = exemplo ou modo sem gravação no Lawyertool
  mensagem: string;
}

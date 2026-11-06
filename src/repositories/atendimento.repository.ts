import type { TarefaAtendimento } from '@/models/atendimento.model';
import { ColecaoJson } from './colecao-json.repository';

const colecao = new ColecaoJson<TarefaAtendimento>('atendimento-tarefas.json');

export async function listarTarefasAtendimento(atendenteId: string): Promise<TarefaAtendimento[]> {
  const todas = await colecao.listar();
  return todas.filter((t) => t.atendenteId === atendenteId).sort((a, b) => a.prazo.localeCompare(b.prazo));
}

export function salvarTarefasAtendimento(tarefas: TarefaAtendimento[]) {
  return colecao.salvarVarios(tarefas);
}

export function atualizarTarefaAtendimento(id: string, alterar: (t: TarefaAtendimento) => TarefaAtendimento) {
  return colecao.atualizar(id, alterar);
}

// Apaga os exemplos de um atendente (para gerar de novo).
export async function removerExemplos(atendenteId: string): Promise<void> {
  await colecao.remover((t) => t.exemplo && t.atendenteId === atendenteId);
}

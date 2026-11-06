import type { EstadoTarefa } from '@/models/tarefa.model';
import { ColecaoJson } from './colecao-json.repository';

const colecao = new ColecaoJson<EstadoTarefa>('estado-tarefas.json');

export function listarEstados() {
  return colecao.listar();
}

export function obterEstado(tarefaId: number) {
  return colecao.obter(String(tarefaId));
}

export function salvarEstado(estado: Omit<EstadoTarefa, 'id'>) {
  return colecao.salvar({ ...estado, id: String(estado.tarefaId) });
}

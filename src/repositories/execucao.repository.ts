import type { Execucao } from '@/models/execucao.model';
import { ColecaoJson } from './colecao-json.repository';

const colecao = new ColecaoJson<Execucao>('execucoes.json');

export async function listarExecucoes(): Promise<Execucao[]> {
  const todas = await colecao.listar();
  return todas.sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm));
}

export function obterExecucao(id: string) {
  return colecao.obter(id);
}

export function salvarExecucao(execucao: Execucao) {
  return colecao.salvar(execucao);
}

export function atualizarExecucao(id: string, alterar: (e: Execucao) => Execucao) {
  return colecao.atualizar(id, alterar);
}

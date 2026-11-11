import type { Agente } from '@/models/agente.model';
import { ColecaoJson } from './colecao-json.repository';

const agentes = new ColecaoJson<Agente>('agentes.json');

export async function listarAgentes(): Promise<Agente[]> {
  return (await agentes.listar()).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export function obterAgente(id: string) {
  return agentes.obter(id);
}

export function salvarAgente(agente: Agente) {
  return agentes.salvar(agente);
}

export function atualizarAgente(id: string, alterar: (a: Agente) => Agente) {
  return agentes.atualizar(id, alterar);
}

export function removerAgente(id: string) {
  return agentes.remover((a) => a.id === id);
}

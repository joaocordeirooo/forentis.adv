import type { AcaoNova, Despesa } from '@/models/rota.model';
import { ColecaoJson } from './colecao-json.repository';

const despesas = new ColecaoJson<Despesa>('rota-despesas.json');
const acoes = new ColecaoJson<AcaoNova>('rota-acoes-novas.json');

export async function listarDespesas(atendenteId: string, inicio: string, fim: string) {
  return (await despesas.listar()).filter((d) => d.atendenteId === atendenteId && d.data >= inicio && d.data <= fim).sort((a, b) => b.data.localeCompare(a.data) || b.criadaEm.localeCompare(a.criadaEm));
}

export function salvarDespesa(despesa: Despesa) {
  return despesas.salvar(despesa);
}

export function removerDespesa(id: string, atendenteId: string) {
  return despesas.remover((d) => d.id === id && d.atendenteId === atendenteId);
}

export async function listarAcoes(atendenteId: string, inicio: string, fim: string) {
  return (await acoes.listar()).filter((a) => a.atendenteId === atendenteId && a.data >= inicio && a.data <= fim).sort((a, b) => b.data.localeCompare(a.data));
}

export function salvarAcao(acao: AcaoNova) {
  return acoes.salvar(acao);
}

// Troca os exemplos (gastos e ações) de um atendente.
export async function substituirExemplos(atendenteId: string, novas: { despesas: Despesa[]; acoes: AcaoNova[] }) {
  await despesas.remover((d) => d.exemplo && d.atendenteId === atendenteId);
  await acoes.remover((a) => a.exemplo && a.atendenteId === atendenteId);
  await despesas.salvarVarios(novas.despesas);
  await acoes.salvarVarios(novas.acoes);
}

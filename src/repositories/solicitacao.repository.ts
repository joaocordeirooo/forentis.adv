import type { Solicitacao, StatusSolicitacao, TipoSolicitacao } from '@/models/solicitacao.model';
import { STATUS_ABERTOS } from '@/models/solicitacao.model';
import { ColecaoJson } from './colecao-json.repository';

const colecao = new ColecaoJson<Solicitacao>('solicitacoes.json');

export interface FiltroSolicitacoes {
  status?: StatusSolicitacao;
  tipo?: TipoSolicitacao;
  tarefaId?: number;
}

export async function listarSolicitacoes(filtro: FiltroSolicitacoes = {}): Promise<Solicitacao[]> {
  const todas = await colecao.listar();
  return todas
    .filter((s) => !filtro.status || s.status === filtro.status)
    .filter((s) => !filtro.tipo || s.tipo === filtro.tipo)
    .filter((s) => filtro.tarefaId === undefined || s.tarefaId === filtro.tarefaId)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

export function obterSolicitacao(id: string) {
  return colecao.obter(id);
}

export function salvarSolicitacao(solicitacao: Solicitacao) {
  return colecao.salvar(solicitacao);
}

export function atualizarSolicitacao(id: string, alterar: (s: Solicitacao) => Solicitacao) {
  return colecao.atualizar(id, (s) => ({ ...alterar(s), atualizadaEm: new Date().toISOString() }));
}

// Solicitação ainda aberta para a mesma tarefa e destinatário (cliente ou a mesma empresa).
export async function buscarAberta(
  tarefaId: number,
  tipo: TipoSolicitacao,
  empresaChave: string | null = null,
): Promise<Solicitacao | null> {
  const todas = await colecao.listar();
  return (
    todas.find(
      (s) =>
        s.tarefaId === tarefaId &&
        s.tipo === tipo &&
        (tipo === 'cliente' || s.empresaChave === empresaChave) &&
        STATUS_ABERTOS.includes(s.status),
    ) ?? null
  );
}

import { SETOR_REVISAO, tipoMonitorado } from '@/config/tarefas.config';
import type { OrigemTarefa } from '@/models/solicitacao.model';
import type { Tarefa } from '@/models/tarefa.model';

const SETOR_REVISAO_PADRAO = { id: SETOR_REVISAO, descricao: 'Revisão' };

const item = (v?: { id: number; descricao?: string } | null) => (v?.id ? { id: v.id, descricao: v.descricao ?? `#${v.id}` } : null);

// Setor, fluxo e tipo da tarefa, gravados na solicitação para a visão geral agrupar por setor.
// Os tipos monitorados são todos do setor Revisão: se o Lawyertool não devolver o setor, assume Revisão.
export function origemDaTarefa(tarefa: Pick<Tarefa, 'setor' | 'fluxo' | 'tipoTarefa'>): OrigemTarefa {
  return {
    setor: item(tarefa.setor) ?? (tipoMonitorado(tarefa.tipoTarefa?.id) ? SETOR_REVISAO_PADRAO : null),
    fluxo: item(tarefa.fluxo),
    tipoTarefa: item(tarefa.tipoTarefa),
  };
}

// Solicitações criadas antes de gravarmos a origem vieram todas dos tipos monitorados (setor Revisão).
export function origemPadraoAntiga(): OrigemTarefa {
  return { setor: SETOR_REVISAO_PADRAO, fluxo: null, tipoTarefa: null };
}

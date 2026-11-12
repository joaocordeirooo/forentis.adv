import type { Atendente } from '@/models/atendimento.model';

// Tipos de tarefa do Atendimento Externo no Lawyertool, por setor (levantados em 05/11/2026).
export const TIPOS_ATENDIMENTO = [
  { setor: 'Setor Invalidez', fluxoId: 102, tipos: [{ id: 278, descricao: 'Coletar Assinatura (A.J) - Invalidez' }, { id: 273, descricao: 'Retorno Ação Nova - Invalidez' }, { id: 274, descricao: 'Localizar Cliente - Invalidez' }, { id: 276, descricao: 'Diversos - Invalidez' }] },
  { setor: 'Revisão', fluxoId: 105, tipos: [{ id: 289, descricao: 'Cliente vai no atendimento - Revisão' }, { id: 286, descricao: 'Localizar Cliente - Revisão' }] },
  { setor: 'Arquivo Central', fluxoId: 107, tipos: [{ id: 269, descricao: 'Devolução CTPS - Arq. Central' }] },
  { setor: 'Arquivo Administrativo', fluxoId: 101, tipos: [{ id: 266, descricao: 'Coletar Assinatura (A.J) - Arq. Adm' }, { id: 262, descricao: 'Localizar Cliente - Arq. Adm' }, { id: 264, descricao: 'Diversos - Arq. Adm' }] },
  { setor: 'Financeiro', fluxoId: 104, tipos: [{ id: 298, descricao: 'Entrega de Concessão - Financeiro' }] },
  { setor: 'Judicial', fluxoId: 106, tipos: [{ id: 296, descricao: 'Prazo Judicial - Judicial' }] },
  { setor: 'Setor de Cálculos - Ações Novas', fluxoId: 54, tipos: [{ id: 303, descricao: 'Retorno Ação Nova - Setor de Cálculo' }] },
];

export const IDS_TIPOS_ATENDIMENTO = TIPOS_ATENDIMENTO.flatMap((s) => s.tipos.map((t) => t.id));

export function setorDoTipoAtendimento(tipoId: number | null | undefined): string | null {
  return TIPOS_ATENDIMENTO.find((s) => s.tipos.some((t) => t.id === tipoId))?.setor ?? null;
}

// Atendente fictício para os testes (não existe no Lawyertool).
export const ATENDENTE_TESTE: Atendente = { id: 'teste', nome: 'Rafael Moreira (fictício)', ficticio: true };

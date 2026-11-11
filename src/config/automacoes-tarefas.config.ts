import type { AutomacaoTarefa } from '@/models/filtro-tarefas.model';
import { SETOR_REVISAO, TIPOS_MONITORADOS } from './tarefas.config';

// Liga um setor/fluxo do Lawyertool a uma automação do Forentis.
// Ao filtrar por um setor ou fluxo daqui, a tela mostra o que o sistema faz com aquelas tarefas.
// IDs conferidos no Lawyertool em 10/11/2026 (setor-tarefa e fluxo-tarefa).
// status 'em_preparacao' = aparece na tela, mas ainda não executa nada.

export const SETOR_INVALIDEZ = 7;
export const SETOR_REQUERIMENTO = 8;
export const FLUXO_COBRAR_DOCUMENTOS_INVALIDEZ = 67;
export const FLUXO_ELABORACAO_REQUERIMENTO = 23;

export const AUTOMACOES_TAREFAS: AutomacaoTarefa[] = [
  {
    id: 'solicitacao-documentos',
    nome: 'Solicitação de documentos externos',
    descricao: 'A IA lê a tarefa, o processo e os arquivos, e prepara os pedidos ao cliente (WhatsApp) e às empresas (e-mail) para conferência.',
    status: 'ativa',
    via: 'forentis',
    setorId: SETOR_REVISAO,
    fluxoIds: [...new Set(TIPOS_MONITORADOS.map((t) => t.fluxoId))],
    tipoTarefaIds: TIPOS_MONITORADOS.map((t) => t.tipoTarefaId),
  },
  {
    id: 'cobranca-documentos-invalidez',
    nome: 'Cobrança de documentos (n8n + ChatGuru)',
    descricao: 'Manda as tarefas selecionadas para o workflow de cobrança do n8n, que dispara a mensagem ao cliente pelo ChatGuru com as regras da Cobrança Docs Invalidez.',
    status: 'ativa', // fica ativa só quando N8N_COBRANCA_WEBHOOK_URL está no .env (ver filtro-tarefas.service)
    via: 'n8n',
    setorId: SETOR_INVALIDEZ,
    fluxoIds: [FLUXO_COBRAR_DOCUMENTOS_INVALIDEZ],
    tipoTarefaIds: null,
  },
  {
    id: 'elaboracao-requerimento',
    nome: 'Elaboração de requerimento pela IA',
    descricao: 'Pega as tarefas de analisar documentos para o requerimento, a IA analisa os documentos, monta o requerimento pronto e conclui a tarefa.',
    status: 'em_preparacao',
    via: 'forentis',
    setorId: SETOR_REQUERIMENTO,
    fluxoIds: [FLUXO_ELABORACAO_REQUERIMENTO],
    tipoTarefaIds: null,
  },
];

// Automações que valem para o filtro escolhido (setor e/ou fluxo).
export function automacoesDoFiltro(setorId?: number, fluxoId?: number): AutomacaoTarefa[] {
  if (!setorId && !fluxoId) return [];
  return AUTOMACOES_TAREFAS.filter((a) => {
    if (setorId && a.setorId !== setorId) return false;
    if (fluxoId && a.fluxoIds && !a.fluxoIds.includes(fluxoId)) return false;
    return true;
  });
}

// Automação que trata uma tarefa específica (pelo setor, fluxo e tipo dela).
export function automacaoDaTarefa(t: { setor?: { id: number } | null; fluxo?: { id: number } | null; tipoTarefa?: { id: number } | null }): AutomacaoTarefa | null {
  return (
    AUTOMACOES_TAREFAS.find(
      (a) =>
        a.setorId === t.setor?.id &&
        (!a.fluxoIds || (t.fluxo?.id !== undefined && a.fluxoIds.includes(t.fluxo.id))) &&
        (!a.tipoTarefaIds || (t.tipoTarefa?.id !== undefined && a.tipoTarefaIds.includes(t.tipoTarefa.id))),
    ) ?? null
  );
}

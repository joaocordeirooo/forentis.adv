import { ATENDENTE_TESTE } from '@/config/atendimento.config';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { iniciarTarefa, obterTarefa, registrarComentarioTarefa } from '@/integrations/lawyertool.integration';
import type { Atendente, ResultadoMaterialColetado } from '@/models/atendimento.model';
import {
  atualizarTarefaAtendimento,
  listarTarefasAtendimento,
  removerExemplos,
  salvarTarefasAtendimento,
} from '@/repositories/atendimento.repository';
import { dataHora } from '@/utils/data.util';
import { semanaAtual } from '@/utils/semana.util';
import { substituirExemplos } from '@/repositories/rota.repository';
import { gerarExemplos, gerarMovimentosExemplo } from './atendimento-exemplos.service';
import {
  atendentesDasTarefas,
  ehTarefaDeAtendimento,
  limparCacheAtendimento,
  tarefasAtendimentoDaSemana,
  usuarioDoAtendente,
  usuarioLiberado,
} from './atendimento-lawyertool.service';

function exigirAtendente(atendenteId: string) {
  if (atendenteId !== ATENDENTE_TESTE.id) throw new AppError('Atendente não encontrado.', 404);
  return ATENDENTE_TESTE;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS_PERIODO = 92;

// Período escolhido (inicio/fim AAAA-MM-DD) ou a semana que contém "semana"; sem nada, a semana atual.
function periodoDe(dados: { semana?: string | null; inicio?: string | null; fim?: string | null }) {
  const { inicio, fim } = dados;
  if (inicio && fim && DATA.test(inicio) && DATA.test(fim)) {
    if (inicio > fim) throw new AppError('A data de início é depois da data de fim.', 400);
    const dias = (Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000;
    if (dias > MAX_DIAS_PERIODO) throw new AppError(`Período muito longo: escolha até ${MAX_DIAS_PERIODO} dias.`, 400);
    return { inicio, fim, diasUteis: [] as string[] };
  }
  return dados.semana && DATA.test(dados.semana) ? semanaAtual(new Date(`${dados.semana}T12:00:00-03:00`)) : semanaAtual();
}

// Tela "Tarefas da semana": tarefas REAIS do Lawyertool separadas por funcionário (todos os setores).
// Sem atendente escolhido, abre no primeiro liberado para execução (fase de teste) ou no que tem mais tarefas.
export async function semanaPorFuncionario(dados: { atendenteId?: string | null; semana?: string | null; inicio?: string | null; fim?: string | null; atualizar?: boolean }) {
  if (dados.atendenteId === ATENDENTE_TESTE.id) {
    return { ...(await tarefasDaSemana(ATENDENTE_TESTE.id)), atendentes: [ATENDENTE_TESTE], buscaIncompleta: false };
  }
  const semana = periodoDe(dados);
  const demanda = await tarefasAtendimentoDaSemana(semana, dados.atualizar);
  const atendentes = atendentesDasTarefas(demanda.tarefas, demanda.nomes);

  let atendente: Atendente | undefined = dados.atendenteId ? atendentes.find((a) => a.id === dados.atendenteId) : undefined;
  if (!atendente && dados.atendenteId) {
    const usuarioId = usuarioDoAtendente(dados.atendenteId);
    if (!usuarioId) throw new AppError('Atendente não encontrado.', 404);
    atendente = { id: dados.atendenteId, nome: `Usuário ${usuarioId}`, ficticio: false, usuarioId, liberado: usuarioLiberado(usuarioId), abertas: 0 };
  }
  atendente ??= atendentes.find((a) => a.liberado) ?? atendentes[0] ?? undefined;

  return {
    atendentes: [...atendentes, ATENDENTE_TESTE],
    atendente: atendente ?? null,
    semana,
    gravaNoLawyertool: Boolean(atendente?.liberado),
    buscaIncompleta: demanda.incompleta,
    tarefas: atendente ? demanda.tarefas.filter((t) => t.atendenteId === atendente.id) : [],
  };
}

// Tarefas da semana do atendente FICTÍCIO. Se os exemplos forem de outra semana (ou não existirem), gera de novo.
export async function tarefasDaSemana(atendenteId: string) {
  const atendente = exigirAtendente(atendenteId);
  const semana = semanaAtual();
  let tarefas = await listarTarefasAtendimento(atendenteId);
  const exemplos = tarefas.filter((t) => t.exemplo);
  const formatoAntigo = exemplos.some((t) => !/^ex-[^-]+-[a-z]+-\d+$/.test(t.id)); // exemplos de antes da rota
  if (atendente.ficticio && (!exemplos.length || formatoAntigo || exemplos.every((t) => t.prazo < semana.inicio))) {
    await removerExemplos(atendenteId);
    await salvarTarefasAtendimento(gerarExemplos(atendenteId));
    await substituirExemplos(atendenteId, gerarMovimentosExemplo(atendenteId));
    tarefas = await listarTarefasAtendimento(atendenteId);
  }
  return {
    atendente,
    semana,
    gravaNoLawyertool: config.atendimento.executarLawyertool,
    tarefas: tarefas.filter((t) => t.prazo >= semana.inicio && t.prazo <= semana.fim),
  };
}

export async function restaurarExemplos(atendenteId: string) {
  exigirAtendente(atendenteId);
  await removerExemplos(atendenteId);
  await salvarTarefasAtendimento(gerarExemplos(atendenteId));
  await substituirExemplos(atendenteId, gerarMovimentosExemplo(atendenteId));
  return tarefasDaSemana(atendenteId);
}

// "Material coletado": inicia todas as tarefas selecionadas.
export async function marcarMaterialColetado(atendenteId: string, ids: string[]): Promise<ResultadoMaterialColetado[]> {
  return atendenteId === ATENDENTE_TESTE.id ? materialColetadoExemplo(atendenteId, ids) : materialColetadoLawyertool(atendenteId, ids);
}

// Tarefas reais: confere cada uma no Lawyertool (responsável, tipo e situação), registra o comentário e inicia.
async function materialColetadoLawyertool(atendenteId: string, ids: string[]): Promise<ResultadoMaterialColetado[]> {
  const usuarioId = usuarioDoAtendente(atendenteId);
  if (!usuarioId) throw new AppError('Atendente não encontrado.', 404);
  const resultados: ResultadoMaterialColetado[] = [];

  for (const id of ids) {
    const tarefaId = Number(id.replace(/^lt-/, ''));
    const base = { id, titulo: '—', cliente: '—', simulado: false };
    if (!Number.isInteger(tarefaId) || tarefaId <= 0) {
      resultados.push({ ...base, ok: false, mensagem: 'Identificador de tarefa inválido.' });
      continue;
    }
    try {
      const t = await obterTarefa(tarefaId, 'id,titulo,situacao,tipoTarefa.id,fluxo.id,usuarioResponsavel.id,usuarioResponsavel.nome,emitente.nome,descricao');
      const r = { ...base, titulo: t?.titulo ?? '—', cliente: t?.emitente?.nome?.trim() ?? '—' };
      if (!t) resultados.push({ ...r, ok: false, mensagem: 'Tarefa não encontrada no Lawyertool.' });
      else if (!(await ehTarefaDeAtendimento(t.fluxo?.id))) resultados.push({ ...r, ok: false, mensagem: 'Não é tarefa do Atendimento Externo.' });
      else if ((t.usuarioResponsavel as { id?: number } | null)?.id !== usuarioId) resultados.push({ ...r, ok: false, mensagem: 'A tarefa não é deste funcionário.' });
      else if (t.situacao === 'iniciada') resultados.push({ ...r, ok: true, mensagem: 'Já estava iniciada.' });
      else if (t.situacao !== 'pendente') resultados.push({ ...r, ok: false, mensagem: `Situação atual "${t.situacao}": só tarefa pendente pode ser iniciada.` });
      else if (!usuarioLiberado(usuarioId)) resultados.push({ ...r, ok: false, mensagem: 'Execução no Lawyertool ainda não liberada para este funcionário (fase de teste).' });
      else {
        await registrarComentarioTarefa(tarefaId, [
          '[ATENDIMENTO_EXTERNO] MATERIAL COLETADO',
          `Atendente: ${t.usuarioResponsavel?.nome ?? '—'}`,
          `Data: ${dataHora(new Date().toISOString())}`,
          'Material retirado no escritório; tarefa iniciada pelo Forentis.',
        ].join('\n'));
        await iniciarTarefa(tarefaId);
        resultados.push({ ...r, ok: true, mensagem: `Iniciada no Lawyertool (tarefa #${tarefaId}).` });
      }
    } catch (erro) {
      resultados.push({ ...base, ok: false, mensagem: (erro as Error).message });
    }
  }
  limparCacheAtendimento();
  return resultados;
}

// Exemplos (atendente fictício) só mudam aqui, sem tocar no Lawyertool.
async function materialColetadoExemplo(atendenteId: string, ids: string[]): Promise<ResultadoMaterialColetado[]> {
  const atendente = exigirAtendente(atendenteId);
  const tarefas = await listarTarefasAtendimento(atendenteId);
  const resultados: ResultadoMaterialColetado[] = [];

  for (const id of ids) {
    const t = tarefas.find((x) => x.id === id);
    if (!t) {
      resultados.push({ id, titulo: '—', cliente: '—', ok: false, simulado: true, mensagem: 'Tarefa não pertence a este atendente.' });
      continue;
    }
    if (t.situacao === 'iniciada') {
      resultados.push({ id, titulo: t.titulo, cliente: t.cliente, ok: true, simulado: true, mensagem: 'Já estava iniciada.' });
      continue;
    }
    await atualizarTarefaAtendimento(t.id, (x) => ({ ...x, situacao: 'iniciada', iniciadaEm: new Date().toISOString(), iniciadaPor: atendente.nome }));
    resultados.push({ id, titulo: t.titulo, cliente: t.cliente, ok: true, simulado: true, mensagem: 'Iniciada (exemplo: nada foi alterado no Lawyertool).' });
  }
  return resultados;
}

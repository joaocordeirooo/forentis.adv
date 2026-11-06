import { ATENDENTE_TESTE } from '@/config/atendimento.config';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { iniciarTarefa, registrarComentarioTarefa } from '@/integrations/lawyertool.integration';
import type { ResultadoMaterialColetado, TarefaAtendimento } from '@/models/atendimento.model';
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

const ATENDENTES = [ATENDENTE_TESTE];

function exigirAtendente(atendenteId: string) {
  const atendente = ATENDENTES.find((a) => a.id === atendenteId);
  if (!atendente) throw new AppError('Atendente não encontrado.', 404);
  return atendente;
}

export function listarAtendentes() {
  return ATENDENTES;
}

// Tarefas da semana do atendente. Se os exemplos forem de outra semana (ou não existirem), gera de novo.
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

function comentario(t: TarefaAtendimento, atendente: string): string {
  return [
    '[ATENDIMENTO_EXTERNO] MATERIAL COLETADO',
    `Atendente: ${atendente}`,
    `Data: ${dataHora(new Date().toISOString())}`,
    `Cliente: ${t.cliente}`,
    `Providência: ${t.descricao}`,
    'Tarefa iniciada automaticamente; conferir o material recebido e concluir.',
  ].join('\n');
}

// "Material coletado": inicia todas as tarefas selecionadas.
// Exemplos (e tarefas reais com ATENDIMENTO_EXECUTAR_LAWYERTOOL=false) só mudam aqui, sem tocar no Lawyertool.
export async function marcarMaterialColetado(atendenteId: string, ids: string[]): Promise<ResultadoMaterialColetado[]> {
  const atendente = exigirAtendente(atendenteId);
  const tarefas = await listarTarefasAtendimento(atendenteId);
  const executar = config.atendimento.executarLawyertool;
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

    const simulado = t.exemplo || !executar || t.tarefaId == null;
    try {
      if (!simulado) {
        await registrarComentarioTarefa(t.tarefaId!, comentario(t, atendente.nome));
        await iniciarTarefa(t.tarefaId!);
      }
      await atualizarTarefaAtendimento(t.id, (x) => ({ ...x, situacao: 'iniciada', iniciadaEm: new Date().toISOString(), iniciadaPor: atendente.nome }));
      resultados.push({
        id, titulo: t.titulo, cliente: t.cliente, ok: true, simulado,
        mensagem: simulado ? 'Iniciada (simulação: nada foi alterado no Lawyertool).' : `Iniciada no Lawyertool (tarefa #${t.tarefaId}).`,
      });
    } catch (erro) {
      resultados.push({ id, titulo: t.titulo, cliente: t.cliente, ok: false, simulado, mensagem: (erro as Error).message });
    }
  }
  return resultados;
}

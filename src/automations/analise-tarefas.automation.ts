import { randomUUID } from 'node:crypto';
import { config } from '@/config/env.config';
import { tipoMonitorado } from '@/config/tarefas.config';
import { AppError } from '@/errors/app.errors';
import type { Execucao, ResultadoTarefa } from '@/models/execucao.model';
import type { Tarefa } from '@/models/tarefa.model';
import { obterEstado, salvarEstado } from '@/repositories/estado-tarefa.repository';
import { atualizarExecucao, listarExecucoes, salvarExecucao } from '@/repositories/execucao.repository';
import { analisarTarefa } from '@/service/analise-tarefa.service';
import { coletarContexto } from '@/service/contexto-tarefa.service';
import { prepararSolicitacaoCliente } from '@/service/solicitacao-cliente.service';
import { agruparEmpresas, prepararSolicitacaoEmpresa } from '@/service/solicitacao-empresa.service';
import { prepararSolicitacaoIndefinida } from '@/service/solicitacao-indefinida.service';
import { buscarTarefasPendentes, buscarTarefasPorIds } from '@/service/tarefa.service';
import { impressaoDaTarefa, triarTarefa } from '@/service/triagem.service';
import { dataHora } from '@/utils/data.util';
import { origemDaTarefa } from '@/utils/origem-tarefa.util';

// O fluxo completo do workflow do n8n, tarefa por tarefa.
// Nada é enviado aqui: cada pedido vira uma solicitação aguardando a conferência do funcionário.

const MOTIVOS_DECISAO: Record<string, string> = {
  consultar_arquivos: 'A IA pediu a leitura de arquivos antes de definir as pendências (etapa ainda não automatizada) — conferir manualmente.',
  conferencia_humana: 'A IA encaminhou para conferência humana.',
};

const EXECUCAO_TRAVADA_HORAS = 8;

// manual = tarefa escolhida a dedo na aba Tarefas: pula a triagem (o funcionário já decidiu que há o que pedir).
async function processarTarefa(tarefa: Tarefa, execucaoId: string, forcar: boolean, manual = false): Promise<ResultadoTarefa> {
  const resultado: ResultadoTarefa = {
    tarefaId: tarefa.id,
    tarefaTitulo: tarefa.titulo,
    tipoTarefa: tarefa.tipoTarefa?.descricao ?? null,
    setor: origemDaTarefa(tarefa).setor?.descricao ?? null,
    processoId: tarefa.processo?.id ?? null,
    clienteNome: tarefa.emitente?.nome ?? null,
    decisaoAnalise: 'erro_contexto',
    resumoAnalise: '',
    tratada: false,
    motivos: [],
    solicitacoes: [],
    observacoes: [],
  };

  let contexto;
  try {
    contexto = await coletarContexto(tarefa);
  } catch (erro) {
    resultado.motivos.push(`Falha ao consultar o Lawyertool: ${(erro as Error).message}`);
    return resultado;
  }
  resultado.clienteNome = contexto.processo.emitente?.nome ?? resultado.clienteNome;

  // Só reanalisa se a tarefa mudou desde a última vez (movimentação, comentário ou arquivo novo).
  const impressao = impressaoDaTarefa(contexto);
  const anterior = await obterEstado(tarefa.id);
  if (!forcar && anterior && anterior.impressao === impressao && !anterior.decisao.startsWith('erro')) {
    return {
      ...resultado,
      decisaoAnalise: 'sem_mudanca',
      tratada: anterior.tratada,
      motivos: anterior.tratada ? [] : anterior.motivos.map((m) => `(desde ${dataHora(anterior.analisadaEm)}) ${m}`),
      solicitacoes: [],
      observacoes: [`Sem novidades desde a análise de ${dataHora(anterior.analisadaEm)} (${anterior.decisao}).`],
    };
  }
  const guardar = (r: ResultadoTarefa, triagem: { envolve: boolean; motivo: string } | null = null) =>
    salvarEstado({
      tarefaId: tarefa.id,
      impressao,
      analisadaEm: new Date().toISOString(),
      decisao: r.decisaoAnalise,
      tratada: r.tratada,
      motivos: r.motivos,
      triagem,
      solicitacoes: r.solicitacoes,
    });

  // Tipos com triagem: a IA confere primeiro se há pedido externo (bem mais barato que a análise completa).
  let triagem: { envolve: boolean; motivo: string } | null = null;
  if (!manual && tipoMonitorado(tarefa.tipoTarefa?.id)?.triagem) {
    try {
      triagem = await triarTarefa(contexto);
    } catch (erro) {
      resultado.decisaoAnalise = 'erro_triagem';
      resultado.motivos.push(`Falha na triagem da IA: ${(erro as Error).message}`);
      return resultado;
    }
    if (!triagem.envolve) {
      resultado.decisaoAnalise = 'triagem_sem_pedido';
      resultado.tratada = true;
      resultado.observacoes.push(`Triagem: sem pedido externo — ${triagem.motivo}`);
      await guardar(resultado, triagem);
      return resultado;
    }
    resultado.observacoes.push(`Triagem: ${triagem.motivo}`);
  }

  const resultadoFinal = await analisarEPreparar(contexto, resultado, execucaoId);
  if (!resultadoFinal.decisaoAnalise.startsWith('erro')) await guardar(resultadoFinal, triagem);
  return resultadoFinal;
}

async function analisarEPreparar(
  contexto: Awaited<ReturnType<typeof coletarContexto>>,
  resultado: ResultadoTarefa,
  execucaoId: string,
): Promise<ResultadoTarefa> {
  const analise = await analisarTarefa(contexto);
  resultado.decisaoAnalise = analise.decisao;
  resultado.resumoAnalise = analise.resumo;
  if (analise.duvidas.length) resultado.observacoes.push(...analise.duvidas.map((d) => `Dúvida da análise: ${d}`));

  if (analise.decisao === 'nenhuma_acao') {
    resultado.tratada = true;
    return resultado;
  }
  if (analise.decisao !== 'preparar_pendencias') {
    resultado.motivos.push(analise.motivo_nao_tratada ?? MOTIVOS_DECISAO[analise.decisao] ?? `Decisão não reconhecida: ${analise.decisao}`);
    if (analise.arquivos_para_ler.length) {
      resultado.observacoes.push(...analise.arquivos_para_ler.map((a) => `Arquivo a ler (${a.id}): ${a.motivo}`));
    }
    return resultado;
  }

  if (!analise.pendencias.length) resultado.motivos.push('A IA indicou preparar_pendencias, mas não listou nenhuma pendência.');
  // Sem destinatário: vai para a fila como "não classificada" (o funcionário diz se é do cliente ou de qual empresa).
  if (analise.pendencias_indefinidas.length) {
    try {
      const id = await prepararSolicitacaoIndefinida(contexto, analise, analise.pendencias_indefinidas, execucaoId);
      resultado.solicitacoes.push(id);
      resultado.observacoes.push(
        `${analise.pendencias_indefinidas.length} pendência(s) sem destinatário foram para a conferência (classificar): ` +
          analise.pendencias_indefinidas.map((p) => `${p.documento || 'sem descrição'}${p.periodo ? ` — ${p.periodo}` : ''}`).join('; ') + '.',
      );
    } catch (erro) {
      for (const p of analise.pendencias_indefinidas) {
        resultado.motivos.push(`Pendência sem destinatário definido (não tratada): ${p.documento || 'sem descrição'}${p.periodo ? ` — ${p.periodo}` : ''}.`);
      }
      resultado.motivos.push(`Falha ao guardar as pendências sem destinatário: ${(erro as Error).message}`);
    }
  }

  // Cliente.
  if (analise.pendencias_cliente.length) {
    try {
      const cliente = await prepararSolicitacaoCliente(contexto, analise, execucaoId);
      if (cliente.solicitacaoId) resultado.solicitacoes.push(cliente.solicitacaoId);
      if (cliente.observacao) resultado.observacoes.push(`Cliente: ${cliente.observacao}`);
      if (!cliente.tratada) resultado.motivos.push(cliente.motivo ?? 'Solicitação ao cliente não preparada.');
    } catch (erro) {
      resultado.motivos.push(`Falha ao preparar a solicitação ao cliente: ${(erro as Error).message}`);
    }
  }

  // Empresas (uma de cada vez).
  const { ativos, acompanhamento } = agruparEmpresas(analise.pendencias_empresa);
  for (const item of acompanhamento) {
    resultado.observacoes.push(`${item.empresa}: só acompanhamento (${item.pendencias.map((p) => p.situacao).join(', ')}).`);
  }
  for (const grupo of ativos) {
    try {
      const empresa = await prepararSolicitacaoEmpresa(contexto, analise, grupo, execucaoId);
      if (empresa.solicitacaoId) resultado.solicitacoes.push(empresa.solicitacaoId);
      if (empresa.observacao) resultado.observacoes.push(empresa.observacao);
      if (!empresa.tratada) resultado.motivos.push(`${empresa.empresa}: ${empresa.motivo ?? 'não preparada'}`);
    } catch (erro) {
      resultado.motivos.push(`${grupo.empresa || 'Empresa não identificada'}: falha ao preparar — ${(erro as Error).message}`);
    }
  }

  resultado.tratada = resultado.motivos.length === 0;
  return resultado;
}

// Cria o registro da execução (e impede duas execuções ao mesmo tempo).
export async function criarExecucao(
  filtroTarefaId: number | null,
  opcoes: { forcar?: boolean; origem?: 'manual' | 'agenda'; tarefaIds?: number[] } = {},
): Promise<Execucao> {
  const limite = Date.now() - EXECUCAO_TRAVADA_HORAS * 3_600_000;
  const rodando = (await listarExecucoes()).find((e) => e.status === 'em_andamento' && Date.parse(e.iniciadaEm) > limite);
  if (rodando) throw new AppError(`Já existe uma execução em andamento (${rodando.id}).`, 409);

  const execucao: Execucao = {
    id: randomUUID(),
    status: 'em_andamento',
    iniciadaEm: new Date().toISOString(),
    finalizadaEm: null,
    modoTeste: config.automacao.modoTeste,
    filtroTarefaId,
    tarefaIds: opcoes.tarefaIds?.length ? [...new Set(opcoes.tarefaIds)] : null,
    origem: opcoes.origem ?? 'manual',
    forcar: opcoes.forcar ?? Boolean(filtroTarefaId || opcoes.tarefaIds?.length), // tarefa escolhida a dedo é sempre reanalisada
    tarefasEncontradas: 0,
    tarefasProcessadas: 0,
    resultados: [],
    erro: null,
  };
  await salvarExecucao(execucao);
  return execucao;
}

// Executa a análise de todas as tarefas pendentes (ou de uma só). Nunca lança erro.
export async function executarAnalise(execucao: Execucao): Promise<void> {
  try {
    if (execucao.tarefaIds?.length) {
      await executarSelecionadas(execucao, execucao.tarefaIds);
      return;
    }
    const { tarefas: encontradas, buscaIncompleta } = await buscarTarefasPendentes(true);
    let tarefas = execucao.filtroTarefaId ? encontradas.filter((t) => t.id === execucao.filtroTarefaId) : encontradas;
    if (execucao.filtroTarefaId && !tarefas.length) {
      throw new Error(`A tarefa ${execucao.filtroTarefaId} não está entre as pendentes do fluxo.`);
    }
    if (execucao.modoTeste) tarefas = tarefas.slice(0, config.automacao.limiteTarefasTeste);

    await atualizarExecucao(execucao.id, (e) => ({ ...e, tarefasEncontradas: encontradas.length }));
    if (buscaIncompleta) console.warn('[automação] busca de tarefas incompleta (limite de páginas).');

    for (const tarefa of tarefas) {
      console.log(`[automação] tarefa ${tarefa.id} — ${tarefa.titulo ?? ''}`);
      const resultado = await processarTarefa(tarefa, execucao.id, execucao.forcar);
      await atualizarExecucao(execucao.id, (e) => ({
        ...e,
        tarefasProcessadas: e.tarefasProcessadas + 1,
        resultados: [...e.resultados, resultado],
      }));
    }

    await atualizarExecucao(execucao.id, (e) => ({ ...e, status: 'concluida', finalizadaEm: new Date().toISOString() }));
  } catch (erro) {
    console.error('[automação] execução falhou', erro);
    await atualizarExecucao(execucao.id, (e) => ({
      ...e,
      status: 'falhou',
      finalizadaEm: new Date().toISOString(),
      erro: (erro as Error).message,
    }));
  }
}

// Tarefas escolhidas na aba Tarefas: de qualquer setor/fluxo, sem o limite do modo teste
// (nada é enviado aqui: tudo vai para a conferência).
async function executarSelecionadas(execucao: Execucao, ids: number[]): Promise<void> {
  const { tarefas, naoEncontradas } = await buscarTarefasPorIds(ids);
  await atualizarExecucao(execucao.id, (e) => ({ ...e, tarefasEncontradas: ids.length }));

  for (const id of naoEncontradas) {
    const resultado: ResultadoTarefa = {
      tarefaId: id, tarefaTitulo: null, tipoTarefa: null, setor: null, processoId: null, clienteNome: null,
      decisaoAnalise: 'erro_contexto', resumoAnalise: '', tratada: false,
      motivos: ['Tarefa não encontrada no Lawyertool.'], solicitacoes: [], observacoes: [],
    };
    await atualizarExecucao(execucao.id, (e) => ({ ...e, tarefasProcessadas: e.tarefasProcessadas + 1, resultados: [...e.resultados, resultado] }));
  }

  for (const tarefa of tarefas) {
    console.log(`[automação] tarefa selecionada ${tarefa.id} — ${tarefa.titulo ?? ''}`);
    const resultado = await processarTarefa(tarefa, execucao.id, true, true);
    await atualizarExecucao(execucao.id, (e) => ({
      ...e,
      tarefasProcessadas: e.tarefasProcessadas + 1,
      resultados: [...e.resultados, resultado],
    }));
  }

  await atualizarExecucao(execucao.id, (e) => ({ ...e, status: 'concluida', finalizadaEm: new Date().toISOString() }));
}

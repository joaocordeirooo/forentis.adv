import type { Execucao } from '@/models/execucao.model';

// Resumo de uma execução, com a lista nominal das tarefas não tratadas e o motivo de cada uma.
export function montarRelatorio(execucao: Execucao) {
  const naoTratadas = execucao.resultados.filter((r) => !r.tratada);
  const solicitacoes = execucao.resultados.flatMap((r) => r.solicitacoes);

  const linhas = [
    `Execução ${execucao.id} — ${execucao.status}${execucao.modoTeste ? ' (MODO TESTE)' : ''}`,
    `Tarefas encontradas: ${execucao.tarefasEncontradas} | processadas: ${execucao.tarefasProcessadas}`,
    `Tratadas: ${execucao.resultados.length - naoTratadas.length} | Não tratadas: ${naoTratadas.length}`,
    `Solicitações preparadas para conferência: ${solicitacoes.length}`,
    ...(execucao.erro ? [`Erro da execução: ${execucao.erro}`] : []),
    '',
  ];
  if (naoTratadas.length) {
    linhas.push('NÃO TRATADAS — motivo de cada uma:');
    for (const t of naoTratadas) {
      linhas.push(`- Tarefa ${t.tarefaId} — ${t.tarefaTitulo ?? 'sem título'} — cliente: ${t.clienteNome ?? 'não informado'} (processo ${t.processoId ?? '?'})`);
      for (const motivo of t.motivos) linhas.push(`    • ${motivo}`);
    }
  }

  return {
    total: execucao.resultados.length,
    tratadas: execucao.resultados.length - naoTratadas.length,
    naoTratadas: naoTratadas.map((t) => ({
      tarefaId: t.tarefaId,
      tarefaTitulo: t.tarefaTitulo,
      clienteNome: t.clienteNome,
      processoId: t.processoId,
      motivos: t.motivos,
    })),
    solicitacoesPreparadas: solicitacoes,
    texto: linhas.join('\n'),
  };
}

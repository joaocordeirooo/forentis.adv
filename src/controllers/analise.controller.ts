import { after } from 'next/server';
import { AppError } from '@/errors/app.errors';
import { criarExecucao, executarAnalise } from '@/automations/analise-tarefas.automation';
import { listarExecucoes, obterExecucao } from '@/repositories/execucao.repository';
import { montarRelatorio } from '@/service/relatorio.service';
import { iniciarAnaliseSchema } from '@/validators/analise.validator';
import { lerCorpo } from '@/validators/validar';

type ComId = { params: Promise<{ id: string }> };

// POST /api/analises — inicia a análise e responde na hora; o trabalho continua em segundo plano.
export async function iniciarAnalise(request: Request): Promise<Response> {
  const { tarefaId, forcar } = await lerCorpo(request, iniciarAnaliseSchema);
  const execucao = await criarExecucao(tarefaId ?? null, { forcar });
  after(() => executarAnalise(execucao));
  return Response.json(
    { execucaoId: execucao.id, status: execucao.status, acompanhar: `/api/analises/${execucao.id}` },
    { status: 202 },
  );
}

// GET /api/analises — últimas execuções (sem os detalhes de cada tarefa).
export async function listarAnalises(): Promise<Response> {
  const execucoes = await listarExecucoes();
  return Response.json(
    execucoes.slice(0, 50).map(({ resultados, ...resto }) => ({
      ...resto,
      naoTratadas: resultados.filter((r) => !r.tratada).length,
    })),
  );
}

// GET /api/analises/:id — execução completa + relatório.
export async function obterAnalise(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const execucao = await obterExecucao(id);
  if (!execucao) throw new AppError('Execução não encontrada.', 404);
  return Response.json({ ...execucao, relatorio: montarRelatorio(execucao) });
}

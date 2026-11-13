import { AppError } from '@/errors/app.errors';
import { obterTarefaDetalhe } from '@/service/tarefa-detalhe.service';
import { listarEstados } from '@/repositories/estado-tarefa.repository';
import { buscarTarefasPendentes } from '@/service/tarefa.service';

// GET /api/tarefas?atualizar=1 — tarefas monitoradas + o que a automação já fez com cada uma.
export async function listarTarefasPendentes(request: Request): Promise<Response> {
  const atualizar = new URL(request.url).searchParams.get('atualizar') === '1';
  const resultado = await buscarTarefasPendentes(atualizar);
  const estados = new Map((await listarEstados()).map((e) => [e.tarefaId, e]));
  return Response.json({
    total: resultado.tarefas.length,
    ...resultado,
    tarefas: resultado.tarefas.map((t) => ({ ...t, estado: estados.get(t.id) ?? null })),
  });
}

// GET /api/tarefas/:id — a tarefa na íntegra (como no Lawyertool) + comentários, histórico e pedidos do Forentis.
export async function obterTarefa(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero < 1) throw new AppError('Tarefa inválida.', 400);
  return Response.json(await obterTarefaDetalhe(numero));
}

import * as atendimento from '@/service/atendimento.service';
import { atendenteSchema, materialColetadoSchema } from '@/validators/atendimento.validator';
import { lerCorpo } from '@/validators/validar';

// GET /api/atendimento/tarefas?atendenteId=teste
export async function listarTarefasSemana(request: Request): Promise<Response> {
  const atendenteId = new URL(request.url).searchParams.get('atendenteId') ?? 'teste';
  return Response.json({ atendentes: atendimento.listarAtendentes(), ...(await atendimento.tarefasDaSemana(atendenteId)) });
}

// POST /api/atendimento/material-coletado — { atendenteId, tarefas: [ids] }
export async function materialColetado(request: Request): Promise<Response> {
  const { atendenteId, tarefas } = await lerCorpo(request, materialColetadoSchema);
  const resultados = await atendimento.marcarMaterialColetado(atendenteId, tarefas);
  return Response.json({ resultados, iniciadas: resultados.filter((r) => r.ok).length });
}

// POST /api/atendimento/exemplos — recria os exemplos da semana
export async function restaurarExemplos(request: Request): Promise<Response> {
  const { atendenteId } = await lerCorpo(request, atendenteSchema);
  return Response.json(await atendimento.restaurarExemplos(atendenteId));
}

import * as atendimento from '@/service/atendimento.service';
import { atendenteSchema, materialColetadoSchema } from '@/validators/atendimento.validator';
import { lerCorpo } from '@/validators/validar';

// GET /api/atendimento/tarefas?atendenteId=u-115&inicio=AAAA-MM-DD&fim=AAAA-MM-DD (ou &semana=AAAA-MM-DD)&atualizar=1
// atendenteId: "u-<id do usuário no Lawyertool>" ou "teste" (fictício). Sem ele, abre no primeiro funcionário liberado.
export async function listarTarefasSemana(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams;
  return Response.json(
    await atendimento.semanaPorFuncionario({ atendenteId: p.get('atendenteId'), semana: p.get('semana'), inicio: p.get('inicio'), fim: p.get('fim'), atualizar: p.get('atualizar') === '1' }),
  );
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

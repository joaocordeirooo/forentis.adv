import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { cobrancaConfigurada, registrarRetorno, solicitarCobranca, statusCobranca } from '@/service/cobranca-n8n.service';
import { retornoCobrancaSchema, solicitarCobrancaSchema } from '@/validators/cobranca-n8n.validator';
import { lerCorpo } from '@/validators/validar';

// GET /api/integracoes/n8n/cobranca?tarefas=1,2,3 — se a integração está ligada + status de cada tarefa
export async function consultarCobranca(request: Request): Promise<Response> {
  const ids = (new URL(request.url).searchParams.get('tarefas') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 500);
  return Response.json({ configurado: cobrancaConfigurada(), tarefas: ids.length ? await statusCobranca(ids) : [] });
}

// POST /api/integracoes/n8n/cobranca — { tarefaIds: [..], solicitadoPor } → dispara o workflow do n8n
export async function criarCobranca(request: Request): Promise<Response> {
  const { tarefaIds, solicitadoPor } = await lerCorpo(request, solicitarCobrancaSchema);
  return Response.json(await solicitarCobranca(tarefaIds, solicitadoPor), { status: 201 });
}

// POST /api/integracoes/n8n/cobranca/retorno — chamado PELO n8n, com o cabeçalho x-n8n-token
export async function receberRetorno(request: Request): Promise<Response> {
  const esperado = cobrancaConfigurada() ? config.n8n.retornoToken : '';
  if (!esperado) throw new AppError('Retorno do n8n desligado: defina N8N_RETORNO_TOKEN no .env.', 503);
  if (request.headers.get('x-n8n-token') !== esperado) throw new AppError('Token do n8n inválido.', 401);
  const { pedidoId, resultados } = await lerCorpo(request, retornoCobrancaSchema);
  return Response.json(await registrarRetorno(pedidoId, resultados));
}

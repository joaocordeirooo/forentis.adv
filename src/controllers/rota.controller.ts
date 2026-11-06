import * as rota from '@/service/rota.service';
import { acaoNovaSchema, despesaSchema, excluirDespesaSchema } from '@/validators/rota.validator';
import { lerCorpo } from '@/validators/validar';

const atendenteDe = (request: Request) => new URL(request.url).searchParams.get('atendenteId') ?? 'teste';

// GET /api/rota?atendenteId=teste — painel completo
export async function obterPainel(request: Request): Promise<Response> {
  return Response.json(await rota.painelRota(atendenteDe(request)));
}

// GET /api/rota/posicao?atendenteId=teste — só a posição (consultada a cada poucos segundos)
export async function obterPosicao(request: Request): Promise<Response> {
  return Response.json(await rota.posicao(atendenteDe(request)));
}

export async function criarDespesa(request: Request): Promise<Response> {
  const dados = await lerCorpo(request, despesaSchema);
  return Response.json(await rota.registrarDespesa(dados), { status: 201 });
}

export async function apagarDespesa(request: Request): Promise<Response> {
  const { id, atendenteId } = await lerCorpo(request, excluirDespesaSchema);
  return Response.json({ removidas: await rota.excluirDespesa(id, atendenteId) });
}

export async function criarAcaoNova(request: Request): Promise<Response> {
  const dados = await lerCorpo(request, acaoNovaSchema);
  return Response.json(await rota.registrarAcao(dados), { status: 201 });
}

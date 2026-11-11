import { AppError } from '@/errors/app.errors';
import * as agentes from '@/service/agente.service';
import { atualizacaoAgenteSchema, criarAgenteSchema, editarAgenteSchema } from '@/validators/agente.validator';
import { lerCorpo } from '@/validators/validar';

type ComId = { params: Promise<{ id: string }> };

// GET /api/agentes — todos os agentes cadastrados
export async function listarAgentes(): Promise<Response> {
  return Response.json(await agentes.listar());
}

// POST /api/agentes — cadastra um agente
export async function criarAgente(request: Request): Promise<Response> {
  return Response.json(await agentes.criar(await lerCorpo(request, criarAgenteSchema)), { status: 201 });
}

// GET /api/agentes/:id
export async function obterAgente(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await agentes.obter(id));
}

// PATCH /api/agentes/:id — edita os dados do agente
export async function editarAgente(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await agentes.editar(id, await lerCorpo(request, editarAgenteSchema)));
}

// DELETE /api/agentes/:id
export async function excluirAgente(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  await agentes.excluir(id);
  return Response.json({ removido: true });
}

// POST /api/agentes/:id/atualizacoes — registra o que o agente está fazendo
export async function registrarAtualizacao(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await agentes.registrarAtualizacao(id, await lerCorpo(request, atualizacaoAgenteSchema)), { status: 201 });
}

// DELETE /api/agentes/:id/atualizacoes?atualizacaoId=...
export async function removerAtualizacao(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const atualizacaoId = new URL(request.url).searchParams.get('atualizacaoId');
  if (!atualizacaoId) throw new AppError('Informe atualizacaoId.', 400);
  return Response.json(await agentes.removerAtualizacao(id, atualizacaoId));
}

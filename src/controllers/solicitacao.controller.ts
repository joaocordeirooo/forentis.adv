import * as solicitacoes from '@/service/solicitacao.service';
import {
  concluirSolicitacaoSchema,
  descartarSolicitacaoSchema,
  editarSolicitacaoSchema,
  filtroSolicitacoesSchema,
} from '@/validators/solicitacao.validator';
import { lerCorpo } from '@/validators/validar';
import { AppError } from '@/errors/app.errors';

type ComId = { params: Promise<{ id: string }> };
type ComAnexo = { params: Promise<{ id: string; anexoId: string }> };

// GET /api/solicitacoes?status=aguardando_conferencia&tipo=cliente
export async function listarSolicitacoes(request: Request): Promise<Response> {
  const busca = Object.fromEntries(new URL(request.url).searchParams);
  const filtro = filtroSolicitacoesSchema.safeParse(busca);
  if (!filtro.success) throw new AppError('Filtro inválido.', 400, filtro.error.issues.map((i) => i.message));
  // A lista vai sem os detalhes pesados (análises dos PDFs, histórico); o detalhe completo vem em GET /:id.
  const lista = await solicitacoes.listar(filtro.data);
  return Response.json(lista.map(({ detalhes: _detalhes, historico: _historico, ...resumo }) => resumo));
}

export async function obterSolicitacao(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await solicitacoes.obter(id));
}

export async function editarSolicitacao(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const dados = await lerCorpo(request, editarSolicitacaoSchema);
  return Response.json(await solicitacoes.editar(id, dados));
}

export async function concluirSolicitacao(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const dados = await lerCorpo(request, concluirSolicitacaoSchema);
  return Response.json(await solicitacoes.concluir(id, dados));
}

export async function descartarSolicitacao(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const dados = await lerCorpo(request, descartarSolicitacaoSchema);
  return Response.json(await solicitacoes.descartar(id, dados));
}

export async function baixarAnexo(_request: Request, { params }: ComAnexo): Promise<Response> {
  const { id, anexoId } = await params;
  const { nome, conteudo } = await solicitacoes.baixarAnexo(id, anexoId);
  return new Response(new Uint8Array(conteudo), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${nome}"` },
  });
}

import * as solicitacoes from '@/service/solicitacao.service';
import { classificarPendencia } from '@/service/solicitacao-indefinida.service';
import {
  classificarPendenciaSchema,
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
  const { nome, conteudo, mimeType } = await solicitacoes.baixarAnexo(id, anexoId);
  return new Response(new Uint8Array(conteudo), {
    headers: { 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${nome}"` },
  });
}

// POST /api/solicitacoes/:id/anexos — multipart: arquivo + por (nome do funcionário).
export async function anexarArquivo(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const arquivo = form?.get('arquivo');
  const por = String(form?.get('por') ?? '').trim();
  if (!(arquivo instanceof File)) throw new AppError('Envie o arquivo no campo "arquivo".', 400);
  if (por.length < 2) throw new AppError('Informe o nome do funcionário.', 400);
  return Response.json(await solicitacoes.anexarArquivo(id, arquivo, por));
}

// DELETE /api/solicitacoes/:id/anexos/:anexoId?por=Nome — só anexos incluídos pelo funcionário.
export async function removerAnexo(request: Request, { params }: ComAnexo): Promise<Response> {
  const { id, anexoId } = await params;
  const por = new URL(request.url).searchParams.get('por')?.trim() ?? '';
  if (por.length < 2) throw new AppError('Informe o nome do funcionário.', 400);
  return Response.json(await solicitacoes.removerAnexo(id, anexoId, por));
}

// POST /api/solicitacoes/:id/classificar — leva uma pendência sem destinatário para o cliente, uma empresa, ou ignora.
export async function classificarSolicitacao(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const dados = await lerCorpo(request, classificarPendenciaSchema);
  return Response.json(await classificarPendencia(id, dados));
}

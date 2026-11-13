import { AppError } from '@/errors/app.errors';
import * as naoVinculados from '@/service/email-nao-vinculado.service';
import { descartarEmailSchema, vincularEmailSchema } from '@/validators/email.validator';
import { lerCorpo } from '@/validators/validar';
import { respostaArquivo } from './email.controller';

type ComId = { params: Promise<{ id: string }> };

const SITUACOES = ['pendente', 'vinculado', 'descartado', 'todos'] as const;

// GET /api/emails/nao-vinculados?situacao=pendente|vinculado|descartado|todos (padrão: pendente)
export async function listarNaoVinculados(request: Request): Promise<Response> {
  const situacao = new URL(request.url).searchParams.get('situacao') ?? 'pendente';
  if (!SITUACOES.includes(situacao as (typeof SITUACOES)[number])) throw new AppError('Situação inválida.', 400);
  return Response.json(await naoVinculados.listar(situacao as (typeof SITUACOES)[number]));
}

// POST /api/emails/nao-vinculados/:id/vincular  { conversaId, funcionario }
export async function vincularEmail(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const dados = await lerCorpo(request, vincularEmailSchema);
  return Response.json(await naoVinculados.vincular(id, dados.conversaId, dados.funcionario));
}

// POST /api/emails/nao-vinculados/:id/descartar  { funcionario }
export async function descartarEmail(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const dados = await lerCorpo(request, descartarEmailSchema);
  return Response.json(await naoVinculados.descartar(id, dados.funcionario));
}

// GET /api/emails/nao-vinculados/:id/anexos/:indice
export async function baixarAnexoNaoVinculado(
  _request: Request,
  { params }: { params: Promise<{ id: string; indice: string }> },
): Promise<Response> {
  const { id, indice } = await params;
  return respostaArquivo(await naoVinculados.obterAnexo(id, Number(indice)));
}

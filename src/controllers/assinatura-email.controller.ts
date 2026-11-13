import { AppError } from '@/errors/app.errors';
import * as assinaturas from '@/service/assinatura-email.service';
import { criarAssinaturaSchema, editarAssinaturaSchema } from '@/validators/assinatura-email.validator';
import { lerCorpo } from '@/validators/validar';

type ComId = { params: Promise<{ id: string }> };

// GET /api/emails/assinaturas
export async function listarAssinaturas(): Promise<Response> {
  return Response.json(await assinaturas.listar());
}

// POST /api/emails/assinaturas
export async function criarAssinatura(request: Request): Promise<Response> {
  return Response.json(await assinaturas.criar(await lerCorpo(request, criarAssinaturaSchema)), { status: 201 });
}

// PATCH /api/emails/assinaturas/:id
export async function editarAssinatura(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await assinaturas.editar(id, await lerCorpo(request, editarAssinaturaSchema)));
}

// DELETE /api/emails/assinaturas/:id
export async function excluirAssinatura(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  await assinaturas.excluir(id);
  return Response.json({ removida: true });
}

// GET /api/emails/assinaturas/:id/previa — página para conferir a assinatura (id "padrao" = sem cadastro)
export async function previaAssinatura(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return new Response(await assinaturas.previa(id), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

// POST /api/emails/assinaturas/:id/imagem — multipart: arquivo (PNG/JPG até 600 KB)
export async function enviarImagemAssinatura(request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const arquivo = form?.get('arquivo');
  if (!(arquivo instanceof File)) throw new AppError('Envie a imagem no campo "arquivo".', 400);
  return Response.json(await assinaturas.salvarImagem(id, arquivo));
}

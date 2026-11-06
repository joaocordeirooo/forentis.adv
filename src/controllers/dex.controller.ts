import * as dex from '@/service/dex.service';
import { perguntaDexSchema } from '@/validators/dex.validator';
import { lerCorpo } from '@/validators/validar';

type ComId = { params: Promise<{ id: string }> };

// POST /api/dex/mensagens — { conversaId?, pessoa?, texto }
export async function perguntar(request: Request): Promise<Response> {
  const dados = await lerCorpo(request, perguntaDexSchema);
  return Response.json(await dex.perguntar(dados));
}

// GET /api/dex/conversas/:id
export async function obterConversa(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await dex.obter(id));
}

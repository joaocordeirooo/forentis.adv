import { consultarCobranca, criarCobranca } from '@/controllers/cobranca-n8n.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(consultarCobranca));
export const POST = tratarErros(exigirChaveApi(criarCobranca));

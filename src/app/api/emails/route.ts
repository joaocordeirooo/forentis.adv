import { enviarEmail, listarConversas } from '@/controllers/email.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(listarConversas));
export const POST = tratarErros(exigirChaveApi(enviarEmail));

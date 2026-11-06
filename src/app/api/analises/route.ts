import { iniciarAnalise, listarAnalises } from '@/controllers/analise.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(listarAnalises));
export const POST = tratarErros(exigirChaveApi(iniciarAnalise));

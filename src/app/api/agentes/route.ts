import { criarAgente, listarAgentes } from '@/controllers/agente.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(listarAgentes));
export const POST = tratarErros(exigirChaveApi(criarAgente));

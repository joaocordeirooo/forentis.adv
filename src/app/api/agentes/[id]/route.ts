import { editarAgente, excluirAgente, obterAgente } from '@/controllers/agente.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(obterAgente));
export const PATCH = tratarErros(exigirChaveApi(editarAgente));
export const DELETE = tratarErros(exigirChaveApi(excluirAgente));

import { editarAssinatura, excluirAssinatura } from '@/controllers/assinatura-email.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const PATCH = tratarErros(exigirChaveApi(editarAssinatura));
export const DELETE = tratarErros(exigirChaveApi(excluirAssinatura));

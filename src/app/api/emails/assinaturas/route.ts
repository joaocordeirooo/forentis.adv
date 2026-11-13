import { criarAssinatura, listarAssinaturas } from '@/controllers/assinatura-email.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(listarAssinaturas));
export const POST = tratarErros(exigirChaveApi(criarAssinatura));

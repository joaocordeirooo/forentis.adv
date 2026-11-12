import { baixarAnexo, removerAnexo } from '@/controllers/solicitacao.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(baixarAnexo));
export const DELETE = tratarErros(exigirChaveApi(removerAnexo));

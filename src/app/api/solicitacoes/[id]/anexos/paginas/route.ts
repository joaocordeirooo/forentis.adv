import { anexarPaginasDocumento } from '@/controllers/solicitacao.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const POST = tratarErros(exigirChaveApi(anexarPaginasDocumento));

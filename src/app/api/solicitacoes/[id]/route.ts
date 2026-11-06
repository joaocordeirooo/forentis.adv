import { editarSolicitacao, obterSolicitacao } from '@/controllers/solicitacao.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(obterSolicitacao));
export const PATCH = tratarErros(exigirChaveApi(editarSolicitacao));

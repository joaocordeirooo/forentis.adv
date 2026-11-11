import { registrarAtualizacao, removerAtualizacao } from '@/controllers/agente.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const POST = tratarErros(exigirChaveApi(registrarAtualizacao));
export const DELETE = tratarErros(exigirChaveApi(removerAtualizacao));

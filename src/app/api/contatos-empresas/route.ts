import { criarContato, listarContatos } from '@/controllers/contato-empresa.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';
import { exigirChaveApi } from '@/middlewares/chave-api.middleware';

export const GET = tratarErros(exigirChaveApi(listarContatos));
export const POST = tratarErros(exigirChaveApi(criarContato));

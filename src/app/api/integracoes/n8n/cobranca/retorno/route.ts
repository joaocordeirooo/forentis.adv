import { receberRetorno } from '@/controllers/cobranca-n8n.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';

// Sem exigirChaveApi: quem chama é o n8n, que se identifica pelo x-n8n-token.
export const POST = tratarErros(receberRetorno);

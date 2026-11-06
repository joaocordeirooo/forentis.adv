import { verificarSaude } from '@/controllers/health.controller';
import { tratarErros } from '@/middlewares/tratar-erros.middleware';

export const GET = tratarErros(verificarSaude);

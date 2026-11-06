import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import type { Controller } from './tratar-erros.middleware';

let avisado = false;

// Exige o cabeçalho x-api-key igual ao API_KEY do .env.
// Sem API_KEY no .env, a API fica aberta (use só em testes no seu computador).
export function exigirChaveApi<C>(controller: Controller<C>): Controller<C> {
  return async (request, context) => {
    const chave = config.api.chave;
    if (!chave) {
      if (!avisado) console.warn('[segurança] API_KEY não definida no .env: a API está sem proteção.');
      avisado = true;
    } else if (request.headers.get('x-api-key') !== chave) {
      throw new AppError('Chave de API ausente ou inválida.', 401);
    }
    return controller(request, context);
  };
}

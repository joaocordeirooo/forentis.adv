import { connection } from 'next/server';
import { AppError } from '@/errors/app.errors';

// Formato de um controller: recebe a requisição e devolve uma resposta.
export type Controller<C> = (request: Request, context: C) => Promise<Response>;

// Recebe um controller e devolve outro, igual, mas protegido por try/catch.
export function tratarErros<C>(controller: Controller<C>): Controller<C> {
  return async (request, context) => {
    await connection(); // garante que a rota rode a cada chamada (nunca vira página estática)
    try {
      return await controller(request, context);
    } catch (erro) {
      if (erro instanceof AppError) {
        return Response.json(
          { erro: erro.message, ...(erro.detalhes !== undefined ? { detalhes: erro.detalhes } : {}) },
          { status: erro.status },
        );
      }
      // Erro inesperado: detalhes só no terminal, nunca para quem chamou.
      console.error('[erro não tratado]', erro);
      return Response.json({ erro: 'Erro interno' }, { status: 500 });
    }
  };
}

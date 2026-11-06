import { z } from 'zod';
import { AppError } from '@/errors/app.errors';

// Lê o corpo JSON da requisição e confere o formato. Erro → 400 com a lista do que está errado.
export async function lerCorpo<T extends z.ZodType>(request: Request, esquema: T): Promise<z.infer<T>> {
  let corpo: unknown = {};
  const texto = await request.text();
  if (texto.trim()) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      throw new AppError('O corpo da requisição não é um JSON válido.', 400);
    }
  }
  const resultado = esquema.safeParse(corpo);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`);
    throw new AppError('Dados inválidos.', 400, problemas);
  }
  return resultado.data;
}

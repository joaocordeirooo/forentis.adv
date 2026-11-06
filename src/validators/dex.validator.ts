import { z } from 'zod';

export const perguntaDexSchema = z.object({
  conversaId: z.string().optional(),
  pessoa: z.string().max(80).optional(),
  texto: z.string().trim().min(1, 'escreva a pergunta').max(2000, 'pergunta muito longa'),
});

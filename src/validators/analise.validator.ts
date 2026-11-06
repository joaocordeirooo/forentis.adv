import { z } from 'zod';

export const iniciarAnaliseSchema = z.object({
  tarefaId: z.number().int().positive().optional(), // vazio = todas as tarefas pendentes
  forcar: z.boolean().optional(), // true = reanalisa também as tarefas sem novidade
});

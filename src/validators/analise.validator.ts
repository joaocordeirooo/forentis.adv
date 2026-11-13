import { z } from 'zod';

export const iniciarAnaliseSchema = z.object({
  tarefaId: z.number().int().positive().optional(), // vazio = todas as tarefas pendentes
  tarefaIds: z.array(z.number().int().positive()).min(1).max(50, 'selecione no máximo 50 tarefas por execução').optional(), // escolhidas na aba Tarefas
  solicitadoPor: z.string().trim().min(2, 'informe seu nome').max(80).optional(), // quem pediu (obrigatório com tarefaIds)
  forcar: z.boolean().optional(), // true = reanalisa também as tarefas sem novidade
});

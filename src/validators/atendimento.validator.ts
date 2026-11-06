import { z } from 'zod';

export const materialColetadoSchema = z.object({
  atendenteId: z.string().min(1),
  tarefas: z.array(z.string().min(1)).min(1, 'selecione ao menos uma tarefa'),
});

export const atendenteSchema = z.object({ atendenteId: z.string().min(1) });

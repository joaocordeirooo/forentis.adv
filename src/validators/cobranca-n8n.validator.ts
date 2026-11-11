import { z } from 'zod';

export const solicitarCobrancaSchema = z.object({
  tarefaIds: z.array(z.number().int().positive()).min(1, 'selecione ao menos uma tarefa').max(200, 'no máximo 200 tarefas por vez'),
  solicitadoPor: z.string().trim().max(80).nullable().optional().transform((v) => (v ? v : null)),
});

// O que o n8n manda de volta no fim (ou durante) a cobrança.
export const retornoCobrancaSchema = z.object({
  pedidoId: z.string().min(1).optional(),
  resultados: z
    .array(
      z.object({
        tarefaId: z.coerce.number().int().positive(),
        status: z.enum(['enviada', 'falha', 'ignorada']),
        detalhe: z.string().trim().max(500).nullable().optional().transform((v) => (v ? v : null)),
      }),
    )
    .min(1),
});

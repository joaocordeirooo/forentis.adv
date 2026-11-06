import { z } from 'zod';

export const novoContatoSchema = z.object({
  empresa: z.string().trim().min(2),
  cnpj: z.string().optional(),
  email: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  observacao: z.string().optional(),
  cidade: z.string().optional(),
  contatoNome: z.string().optional(),
  origem: z.string().optional(),
});

// Aceita uma lista de contatos ou o texto de um CSV.
export const importarContatosSchema = z.union([
  z.object({ contatos: z.array(novoContatoSchema).min(1) }),
  z.object({ csv: z.string().min(10) }),
]);

export type NovoContato = z.infer<typeof novoContatoSchema>;

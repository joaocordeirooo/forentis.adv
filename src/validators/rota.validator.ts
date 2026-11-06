import { z } from 'zod';
import { CATEGORIAS_DESPESA } from '@/config/rota.config';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD').optional();

export const despesaSchema = z.object({
  atendenteId: z.string().min(1),
  data,
  categoria: z.enum(Object.keys(CATEGORIAS_DESPESA) as [keyof typeof CATEGORIAS_DESPESA, ...(keyof typeof CATEGORIAS_DESPESA)[]]),
  valor: z.number().positive('valor deve ser maior que zero').max(100_000),
  descricao: z.string().trim().max(200).nullable().default(null),
  cidade: z.string().trim().max(80).nullable().default(null),
  litros: z.number().positive().max(500).nullable().default(null),
});

export const acaoNovaSchema = z.object({
  atendenteId: z.string().min(1),
  data,
  cliente: z.string().trim().min(3, 'informe o cliente'),
  cidade: z.string().trim().min(2, 'informe a cidade'),
  tipo: z.string().trim().min(3, 'informe o tipo de ação'),
  observacao: z.string().trim().max(500).nullable().default(null),
});

export const excluirDespesaSchema = z.object({ atendenteId: z.string().min(1), id: z.string().min(1) });

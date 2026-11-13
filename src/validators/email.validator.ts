import { z } from 'zod';
import { STATUS_CONVERSA, TIPOS_VINCULO } from '@/models/email.model';

const endereco = z.string().trim().pipe(z.email('e-mail inválido'));

export const enviarEmailSchema = z
  .object({
    conversaId: z.string().trim().min(1).optional(), // informado = lembrete na mesma conversa
    para: z.array(endereco).max(10).default([]),
    cc: z.array(endereco).max(10).default([]),
    assunto: z.string().trim().max(200).default(''),
    texto: z.string().trim().min(5, 'escreva o texto do e-mail').max(20000),
    funcionario: z.string().trim().min(2, 'informe quem está enviando').max(80),
    vinculo: z
      .object({
        tipo: z.enum(TIPOS_VINCULO).default('avulso'),
        solicitacaoId: z.string().trim().nullish(),
        tarefaId: z.number().int().positive().nullish(),
        processoId: z.number().int().positive().nullish(),
        empresa: z.string().trim().max(200).nullish(),
      })
      .default({ tipo: 'avulso' }),
    anexos: z
      .array(
        z.object({
          nome: z.string().trim().min(1).max(200),
          conteudoBase64: z.string().min(1),
          mimeType: z.string().trim().max(100).optional(),
        }),
      )
      .max(10)
      .default([]),
  })
  .refine((d) => d.conversaId || d.para.length, { message: 'informe ao menos um destinatário', path: ['para'] })
  .refine((d) => d.conversaId || d.assunto, { message: 'informe o assunto', path: ['assunto'] });

// Filtro da listagem (query string).
export const filtroConversasSchema = z.object({
  status: z.enum(STATUS_CONVERSA).optional(),
  tipo: z.enum(TIPOS_VINCULO).optional(),
  tarefaId: z.coerce.number().int().positive().optional(),
  solicitacaoId: z.string().trim().min(1).optional(),
  busca: z.string().trim().max(100).optional(),
});

const sim = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1'));

export const filtroMonitoramentoSchema = filtroConversasSchema.extend({
  semResposta: sim,
  respostaNova: sim,
});

export const vincularEmailSchema = z.object({
  conversaId: z.string().trim().min(1, 'informe a conversa'),
  funcionario: z.string().trim().min(2, 'informe quem está vinculando').max(80),
});

export const descartarEmailSchema = z.object({
  funcionario: z.string().trim().min(2, 'informe quem está descartando').max(80),
});

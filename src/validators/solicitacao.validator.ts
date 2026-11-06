import { z } from 'zod';

const funcionario = z.string().trim().min(2, 'informe o nome do funcionário');

export const filtroSolicitacoesSchema = z.object({
  status: z.enum(['aguardando_conferencia', 'bloqueada', 'concluida', 'falha_envio', 'descartada', 'substituida']).optional(),
  tipo: z.enum(['cliente', 'empresa']).optional(),
  tarefaId: z.coerce.number().int().positive().optional(),
});

export const editarSolicitacaoSchema = z.object({
  por: funcionario,
  texto: z.string().trim().min(3).optional(),
  assunto: z.string().trim().min(3).optional(),
  destinatario: z
    .object({
      nome: z.string().trim().min(2).optional(),
      telefone: z.string().trim().optional(),
      email: z.email('e-mail inválido').optional(),
    })
    .optional(),
  anexos: z.array(z.object({ id: z.string(), incluir: z.boolean() })).optional(),
});

export const concluirSolicitacaoSchema = z.object({
  funcionario,
  ignorarBloqueios: z.boolean().optional(),
});

export const descartarSolicitacaoSchema = z.object({
  funcionario,
  motivo: z.string().trim().min(3, 'informe o motivo'),
});

export type EditarSolicitacao = z.infer<typeof editarSolicitacaoSchema>;
export type ConcluirSolicitacao = z.infer<typeof concluirSolicitacaoSchema>;
export type DescartarSolicitacao = z.infer<typeof descartarSolicitacaoSchema>;

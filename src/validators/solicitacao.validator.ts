import { z } from 'zod';

const funcionario = z.string().trim().min(2, 'informe o nome do funcionário');

export const filtroSolicitacoesSchema = z.object({
  status: z.enum(['aguardando_conferencia', 'bloqueada', 'concluida', 'falha_envio', 'descartada', 'substituida']).optional(),
  tipo: z.enum(['cliente', 'empresa', 'indefinida']).optional(),
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

export const classificarPendenciaSchema = z.object({
  por: funcionario,
  indice: z.number().int().min(0),
  destino: z.enum(['cliente', 'empresa', 'ignorar']),
  empresa: z.string().trim().min(2, 'informe o nome da empresa').optional(),
});

export type ClassificarPendencia = z.infer<typeof classificarPendenciaSchema>;
export type EditarSolicitacao = z.infer<typeof editarSolicitacaoSchema>;
export type ConcluirSolicitacao = z.infer<typeof concluirSolicitacaoSchema>;
export type DescartarSolicitacao = z.infer<typeof descartarSolicitacaoSchema>;

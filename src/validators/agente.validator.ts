import { z } from 'zod';
import { PLATAFORMAS_AGENTE, STATUS_AGENTE } from '@/models/agente.model';

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const campos = {
  nome: z.string().trim().min(2, 'informe o nome do agente').max(80),
  descricao: z.string().trim().min(5, 'descreva o que o agente faz').max(2000),
  status: z.enum(STATUS_AGENTE),
  plataforma: z.enum(PLATAFORMAS_AGENTE),
  setor: textoOpcional(80),
  gatilho: textoOpcional(120),
  responsavel: textoOpcional(80),
  ferramentas: z.array(z.string().trim().min(1).max(40)).max(20),
  link: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https?:\/\//i.test(v), 'o link deve começar com http:// ou https://'),
};

export const criarAgenteSchema = z.object({
  ...campos,
  ferramentas: campos.ferramentas.default([]),
  fazendoAgora: textoOpcional(1000), // opcional: já registra a primeira atualização
  autor: textoOpcional(80),
});

// Na edição, campo que não veio fica como está.
export const editarAgenteSchema = z.object(campos).partial();

export const atualizacaoAgenteSchema = z.object({
  texto: z.string().trim().min(2, 'escreva o que o agente está fazendo').max(1000),
  autor: textoOpcional(80),
});

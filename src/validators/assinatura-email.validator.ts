import { z } from 'zod';

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const campos = {
  nome: z.string().trim().min(2, 'informe o nome como sai na assinatura').max(80),
  cargo: textoOpcional(80),
  oab: textoOpcional(40),
  telefone: textoOpcional(30),
  whatsapp: textoOpcional(30),
  email: textoOpcional(120).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'e-mail inválido'),
  imagem: textoOpcional(120).refine(
    (v) => !v || /^[\w.-]+\.(png|jpe?g|gif)$/i.test(v),
    'informe só o nome do arquivo (png, jpg ou gif) que está em public/email/assinaturas',
  ),
  ativa: z.boolean(),
};

export const criarAssinaturaSchema = z.object({ ...campos, ativa: campos.ativa.default(true) });

// Na edição, campo que não veio fica como está.
export const editarAssinaturaSchema = z.object(campos).partial();

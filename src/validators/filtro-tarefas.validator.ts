import { z } from 'zod';
import { AppError } from '@/errors/app.errors';
import { SITUACOES_TAREFA, type FiltroTarefas } from '@/models/filtro-tarefas.model';

const id = z.coerce.number().int().positive().optional();
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD')
  .optional();

const esquema = z.object({
  setorId: id,
  fluxoId: id,
  usuarioId: id,
  situacao: z.array(z.enum(SITUACOES_TAREFA)).default(['pendente', 'iniciada', 'bloqueada']),
  dataInicioDe: data,
  dataInicioAte: data,
  dataFinalEsperadaDe: data,
  dataFinalEsperadaAte: data,
  dataFinalRealDe: data,
  dataFinalRealAte: data,
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
  todas: z.enum(['1', 'true']).optional(),
});

// Lê o filtro da URL: /api/tarefas/filtro?setorId=7&fluxoId=67&situacao=pendente&situacao=iniciada&...
// situacao pode vir repetida ou separada por vírgula.
export function lerFiltroTarefas(request: Request): FiltroTarefas {
  const p = new URL(request.url).searchParams;
  const bruto: Record<string, unknown> = {};
  for (const [nome, valor] of p.entries()) {
    if (nome === 'situacao') continue;
    if (valor.trim()) bruto[nome] = valor.trim();
  }
  const situacoes = p.getAll('situacao').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
  if (situacoes.length) bruto.situacao = situacoes;

  const r = esquema.safeParse(bruto);
  if (!r.success) {
    throw new AppError('Filtro inválido.', 400, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  const f = r.data;
  return {
    setorId: f.setorId,
    fluxoId: f.fluxoId,
    usuarioId: f.usuarioId,
    situacoes: f.situacao,
    dataInicio: { inicio: f.dataInicioDe, fim: f.dataInicioAte },
    dataFinalEsperada: { inicio: f.dataFinalEsperadaDe, fim: f.dataFinalEsperadaAte },
    dataFinalReal: { inicio: f.dataFinalRealDe, fim: f.dataFinalRealAte },
    pagina: f.pagina,
    porPagina: f.porPagina,
    todas: Boolean(f.todas),
  };
}

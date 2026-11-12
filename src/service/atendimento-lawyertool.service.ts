import { TIPOS_ATENDIMENTO, setorDoTipoAtendimento } from '@/config/atendimento.config';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { concluirTarefa, listarFluxosTarefa, listarTarefasComFiltro, obterTarefa, registrarComentarioTarefa } from '@/integrations/lawyertool.integration';
import type { Atendente, SituacaoAtendimento, TarefaAtendimento } from '@/models/atendimento.model';
import { dataHora } from '@/utils/data.util';
import { normalizar, textoDeHtml } from '@/utils/texto.util';
import { formatarCnj } from './dex-processos.service';

// Tarefas REAIS do Atendimento Externo no Lawyertool (todos os setores), separadas por funcionário.

interface TarefaLt {
  id: number;
  titulo?: string | null;
  descricao?: string | null;
  situacao?: string | null;
  dataFinalEsperada?: string | null;
  dataFinalReal?: string | null;
  dataInicio?: string | null;
  tipoTarefa?: { id: number; descricao?: string; tarefaFinal?: boolean | null } | null;
  fluxo?: { id: number; descricao?: string } | null;
  setor?: { id?: number; descricao?: string } | null;
  usuarioResponsavel?: { id: number; nome?: string } | null;
  emitente?: { nome?: string; cidade?: { nome?: string } | null } | null;
  processo?: { id?: number; numeroProcesso?: string | null } | null;
}

const CAMPOS = [
  'id', 'titulo', 'descricao', 'situacao', 'dataFinalEsperada', 'dataFinalReal', 'dataInicio',
  'tipoTarefa.id', 'tipoTarefa.descricao', 'tipoTarefa.tarefaFinal', 'fluxo.id', 'fluxo.descricao', 'setor.id', 'setor.descricao', 'usuarioResponsavel.id', 'usuarioResponsavel.nome',
  'emitente.nome', 'emitente.cidade.nome', 'processo.id', 'processo.numeroProcesso',
].join(',');

const VALIDADE_FLUXOS_MS = 30 * 60_000;

// Tarefa de atendimento externo = tarefa de qualquer fluxo cujo nome começa com "Atendimento Externo"
// (pega sozinho os tipos e fluxos novos). Se o Lawyertool falhar, usa os fluxos conhecidos da config.
let cacheFluxos: { em: number; ids: number[] } | null = null;
const FLUXOS_CONHECIDOS = TIPOS_ATENDIMENTO.map((s) => s.fluxoId);

export async function fluxosAtendimento(): Promise<number[]> {
  if (cacheFluxos && Date.now() - cacheFluxos.em < VALIDADE_FLUXOS_MS) return cacheFluxos.ids;
  try {
    const resposta = await listarFluxosTarefa();
    const ids = (resposta.data ?? []).filter((f) => normalizar(f.descricao).startsWith('atendimento externo')).map((f) => f.id);
    if (!ids.length) return FLUXOS_CONHECIDOS;
    cacheFluxos = { em: Date.now(), ids };
    return ids;
  } catch (erro) {
    console.error('[atendimento] falha ao listar fluxos; usando os conhecidos:', erro);
    return FLUXOS_CONHECIDOS;
  }
}

export async function ehTarefaDeAtendimento(fluxoId: number | null | undefined): Promise<boolean> {
  return Boolean(fluxoId) && (await fluxosAtendimento()).includes(fluxoId as number);
}

// "Atendimento Externo - Arq. Adm" -> setor da tarefa; sem setor, cai no da config ou no nome do fluxo.
function setorDaTarefa(t: TarefaLt): string {
  return (
    t.setor?.descricao?.trim() ||
    setorDoTipoAtendimento(t.tipoTarefa?.id) ||
    t.fluxo?.descricao?.replace(/^atendimento externo\s*-\s*/i, '').trim() ||
    'Outro'
  );
}

const POR_PAGINA = 200;
const MAX_PAGINAS = 10;
const VALIDADE_CACHE_MS = 60_000;
export const PREFIXO_ATENDENTE = 'u-';
const SEM_RESPONSAVEL = `${PREFIXO_ATENDENTE}0`;

export function idAtendente(usuarioId: number | null | undefined) {
  return usuarioId ? `${PREFIXO_ATENDENTE}${usuarioId}` : SEM_RESPONSAVEL;
}

export function usuarioDoAtendente(atendenteId: string): number | null {
  if (!atendenteId.startsWith(PREFIXO_ATENDENTE)) return null;
  const id = Number(atendenteId.slice(PREFIXO_ATENDENTE.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function usuarioLiberado(usuarioId: number | null | undefined): boolean {
  const { executarLawyertool, usuariosLiberados } = config.atendimento;
  return Boolean(executarLawyertool && usuarioId && usuariosLiberados.includes(usuarioId));
}

function converter(t: TarefaLt): TarefaAtendimento {
  const situacao: SituacaoAtendimento = t.situacao === 'iniciada' ? 'iniciada' : t.situacao === 'concluida' ? 'concluida' : 'pendente';
  const descricao = textoDeHtml(t.descricao);
  return {
    id: `lt-${t.id}`,
    tarefaId: t.id,
    exemplo: false,
    atendenteId: idAtendente(t.usuarioResponsavel?.id),
    setor: setorDaTarefa(t),
    tipo: t.tipoTarefa?.descricao ?? t.titulo ?? '',
    titulo: t.titulo ?? '',
    descricao: descricao || '(sem descrição na tarefa)',
    cliente: (t.emitente?.nome ?? 'cliente não informado').trim(),
    cidade: t.emitente?.cidade?.nome ?? null,
    processo: formatarCnj(t.processo?.numeroProcesso),
    prazo: String(t.dataFinalEsperada ?? '').slice(0, 10),
    situacao,
    iniciadaEm: t.dataInicio ?? null,
    iniciadaPor: null,
    concluidaEm: t.dataFinalReal ?? null,
    tarefaFinal: typeof t.tipoTarefa?.tarefaFinal === 'boolean' ? t.tipoTarefa.tarefaFinal : null,
  };
}

// Lê todas as páginas de um filtro (com teto).
async function lerTodas(parametros: Record<string, string | number>): Promise<{ tarefas: TarefaLt[]; incompleta: boolean }> {
  const tarefas: TarefaLt[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const resposta = await listarTarefasComFiltro<TarefaLt>({ ...parametros, _page: pagina, _limit: POR_PAGINA, _sort: 'id', _order: 'asc', displayFields: CAMPOS });
    const lote = resposta.data ?? [];
    tarefas.push(...lote);
    if (lote.length < POR_PAGINA) return { tarefas, incompleta: false };
  }
  return { tarefas, incompleta: true };
}


interface DemandaSemana {
  tarefas: TarefaAtendimento[];
  nomes: Record<string, string>; // atendenteId -> nome do funcionário
  incompleta: boolean; // passou do teto de páginas
}

let cache: { chave: string; em: number; dados: DemandaSemana } | null = null;

// Demanda da semana (todas as pessoas): abertas com data final esperada até o fim da semana (inclui atrasadas)
// + concluídas com data final esperada dentro da semana.
export async function tarefasAtendimentoDaSemana(semana: { inicio: string; fim: string }, forcar = false): Promise<DemandaSemana> {
  const chave = `${semana.inicio}|${semana.fim}`;
  if (!forcar && cache && cache.chave === chave && Date.now() - cache.em < VALIDADE_CACHE_MS) return cache.dados;

  const fluxos = await fluxosAtendimento();
  const filtroTipos = { 'fluxo.id': fluxos.join(','), 'fluxo.id_operator': fluxos.length === 1 ? 'equals' : 'in' };
  const [abertas, concluidas] = await Promise.all([
    lerTodas({ ...filtroTipos, situacao: 'pendente,iniciada', situacao_operator: 'in', dataFinalEsperada: `${semana.fim} 23:59:59`, dataFinalEsperada_operator: 'lte' }),
    lerTodas({ ...filtroTipos, situacao: 'concluida', situacao_operator: 'equals', dataFinalEsperada: `${semana.inicio} 00:00:00,${semana.fim} 23:59:59`, dataFinalEsperada_operator: 'between' }),
  ]);
  const brutas = [...abertas.tarefas, ...concluidas.tarefas];
  const nomes: Record<string, string> = {};
  for (const t of brutas) if (t.usuarioResponsavel?.nome) nomes[idAtendente(t.usuarioResponsavel.id)] = t.usuarioResponsavel.nome.trim();
  const dados: DemandaSemana = {
    nomes,
    tarefas: brutas.map(converter).sort((a, b) => a.prazo.localeCompare(b.prazo) || a.cliente.localeCompare(b.cliente)),
    incompleta: abertas.incompleta || concluidas.incompleta,
  };
  cache = { chave, em: Date.now(), dados };
  return dados;
}

export function limparCacheAtendimento() {
  cache = null;
}

// Funcionários com tarefas na semana, do que tem mais tarefas abertas para o que tem menos.
export function atendentesDasTarefas(tarefas: TarefaAtendimento[], nomes: Record<string, string>): Atendente[] {
  const grupos = new Map<string, TarefaAtendimento[]>();
  for (const t of tarefas) grupos.set(t.atendenteId, [...(grupos.get(t.atendenteId) ?? []), t]);
  return [...grupos.entries()]
    .map(([id, lista]) => {
      const usuarioId = usuarioDoAtendente(id);
      return {
        id,
        nome: nomes[id] ?? (usuarioId ? `Usuário ${usuarioId}` : 'Sem responsável'),
        ficticio: false,
        usuarioId,
        liberado: usuarioLiberado(usuarioId),
        abertas: lista.filter((t) => t.situacao !== 'concluida').length,
      };
    })
    .sort((a, b) => b.abertas - a.abertas || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---- Conclusão pela DEX ----

export interface ResultadoConclusao {
  ok: boolean;
  tarefaId: number;
  cliente: string | null;
  mensagem: string;
}

// O atendente informou à DEX que cumpriu: registra o relato como comentário e conclui a tarefa no Lawyertool.
export async function concluirTarefaAtendimento(dados: { tarefaId: number; relato: string; informadoPor: string | null }): Promise<ResultadoConclusao> {
  const tarefa = (await obterTarefa(dados.tarefaId, CAMPOS)) as TarefaLt | null;
  if (!tarefa) throw new AppError(`Tarefa #${dados.tarefaId} não encontrada no Lawyertool.`, 404);
  const cliente = tarefa.emitente?.nome?.trim() ?? null;
  const falha = (mensagem: string): ResultadoConclusao => ({ ok: false, tarefaId: dados.tarefaId, cliente, mensagem });

  if (!(await ehTarefaDeAtendimento(tarefa.fluxo?.id))) return falha('A tarefa não é do Atendimento Externo; a DEX só conclui tarefas de atendimento externo.');
  if (tarefa.situacao === 'concluida') return falha('A tarefa já estava concluída.');
  // Tipo que não é "tarefa final" exige criar a próxima tarefa ao concluir: isso fica no Lawyertool, com a pessoa.
  // Confere ANTES do comentário, para não deixar registro de "cumprida" em tarefa que não foi concluída.
  if (tarefa.tipoTarefa?.tarefaFinal === false) {
    return falha(`O tipo "${tarefa.tipoTarefa.descricao ?? tarefa.tipoTarefa.id}" não é tarefa final: o Lawyertool exige criar a próxima tarefa ao concluir. Conclua esta pelo Lawyertool.`);
  }
  if (tarefa.situacao !== 'pendente' && tarefa.situacao !== 'iniciada') return falha(`A tarefa está "${tarefa.situacao}" e não pode ser concluída por aqui.`);
  if (!usuarioLiberado(tarefa.usuarioResponsavel?.id)) {
    return falha(`Conclusão automática ainda não liberada para ${tarefa.usuarioResponsavel?.nome ?? 'o responsável desta tarefa'} (fase de teste). Conclua pelo Lawyertool.`);
  }
  const relato = dados.relato.trim();
  if (relato.length < 3) return falha('Falta o relato do que foi feito no atendimento.');

  await registrarComentarioTarefa(
    dados.tarefaId,
    [
      '[ATENDIMENTO_EXTERNO] CUMPRIDA',
      `Informado por: ${dados.informadoPor ?? 'funcionário não identificado'} (via DEX)`,
      `Data: ${dataHora(new Date().toISOString())}`,
      `Relato: ${relato}`,
    ].join('\n'),
  );
  await concluirTarefa(dados.tarefaId);
  limparCacheAtendimento();
  return { ok: true, tarefaId: dados.tarefaId, cliente, mensagem: `Tarefa #${dados.tarefaId} concluída no Lawyertool, com o relato registrado em comentário.` };
}

import { AUTOMACOES_TAREFAS, automacaoDaTarefa, automacoesDoFiltro } from '@/config/automacoes-tarefas.config';
import {
  listarFluxosTarefa,
  listarSetoresTarefa,
  listarTarefasComFiltro,
  listarUsuariosAtivos,
} from '@/integrations/lawyertool.integration';
import {
  SITUACOES_TAREFA,
  type FiltroTarefas,
  type Intervalo,
  type OpcoesFiltroTarefas,
  type ResultadoFiltroTarefas,
  type TarefaFiltrada,
} from '@/models/filtro-tarefas.model';
import type { AutomacaoTarefa } from '@/models/filtro-tarefas.model';
import { cobrancaConfigurada } from './cobranca-n8n.service';

// Automações que dependem do n8n só ficam ativas com o webhook configurado no .env.
function comStatusReal(lista: AutomacaoTarefa[]): AutomacaoTarefa[] {
  const n8nOk = cobrancaConfigurada();
  return lista.map((a) =>
    a.via === 'n8n' && !n8nOk
      ? { ...a, status: 'em_preparacao', motivoInativa: 'Aguardando a rota do n8n (N8N_COBRANCA_WEBHOOK_URL no .env).' }
      : a,
  );
}

export const LIMITE_TODAS = 2000; // modo "todas": teto de tarefas trazidas de uma vez
const POR_PAGINA_TODAS = 200;
const VALIDADE_OPCOES_MS = 30 * 60_000; // setores, fluxos e usuários mudam pouco: guarda 30 minutos

// Mesmos campos da tela de tarefas do Lawyertool.
const CAMPOS = [
  'id', 'titulo', 'situacao', 'prioridade', 'atrasada', 'diasAtraso', 'destaca',
  'tipoTarefa.id', 'tipoTarefa.descricao',
  'setor.id', 'setor.descricao',
  'fluxo.id', 'fluxo.descricao',
  'usuarioResponsavel.id', 'usuarioResponsavel.nome',
  'usuarioSolicitante.id', 'usuarioSolicitante.nome',
  'processo.id', 'processo.numeroProcesso',
  'emitente.id', 'emitente.nome',
  'dataInicio', 'dataFinalEsperada', 'dataFinalReal',
].join(',');

let cacheOpcoes: OpcoesFiltroTarefas | null = null;

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

// Setores, fluxos e usuários ativos para montar os campos do filtro.
export async function opcoesFiltroTarefas(forcar = false): Promise<OpcoesFiltroTarefas> {
  if (!forcar && cacheOpcoes && Date.now() - Date.parse(cacheOpcoes.atualizadoEm) < VALIDADE_OPCOES_MS) return cacheOpcoes;

  const [setores, fluxos, usuarios] = await Promise.all([listarSetoresTarefa(), listarFluxosTarefa(), listarUsuariosAtivos()]);

  cacheOpcoes = {
    setores: (setores.data ?? [])
      .filter((s) => s.ativo !== false)
      .map((s) => ({ id: s.id, descricao: s.descricao }))
      .sort((a, b) => porNome(a.descricao, b.descricao)),
    fluxos: (fluxos.data ?? [])
      .filter((f) => f.ativo !== false) // a API às vezes ignora o filtro: confere de novo
      .map((f) => ({ id: f.id, descricao: f.descricao, setorId: f.setor?.id ?? null, setorDescricao: f.setor?.descricao ?? null }))
      .sort((a, b) => porNome(a.descricao, b.descricao)),
    usuarios: (usuarios.data ?? [])
      .filter((u) => !u.situacao || u.situacao === 'Ativo')
      .map((u) => ({ id: u.id, nome: u.nome }))
      .sort((a, b) => porNome(a.nome, b.nome)),
    situacoes: SITUACOES_TAREFA,
    automacoes: comStatusReal(AUTOMACOES_TAREFAS),
    atualizadoEm: new Date().toISOString(),
  };
  return cacheOpcoes;
}

// Intervalo de datas no formato que o Lawyertool entende.
// Os campos de data da tarefa têm hora: o fim vai até 23:59:59 para incluir o dia inteiro.
function filtroData(campo: string, intervalo: Intervalo, parametros: Record<string, string | number>) {
  const { inicio, fim } = intervalo;
  if (inicio && fim) {
    parametros[campo] = `${inicio} 00:00:00,${fim} 23:59:59`;
    parametros[`${campo}_operator`] = 'between';
  } else if (inicio) {
    parametros[campo] = `${inicio} 00:00:00`;
    parametros[`${campo}_operator`] = 'gte';
  } else if (fim) {
    parametros[campo] = `${fim} 23:59:59`;
    parametros[`${campo}_operator`] = 'lte';
  }
}

// Busca no Lawyertool só as tarefas do filtro (paginado no próprio Lawyertool).
export async function buscarTarefasFiltradas(filtro: FiltroTarefas): Promise<ResultadoFiltroTarefas> {
  const parametros: Record<string, string | number> = {
    _page: filtro.pagina,
    _limit: filtro.porPagina,
    _sort: 'id',
    _order: 'desc',
    displayFields: CAMPOS,
  };
  if (filtro.setorId) {
    parametros['setor.id'] = filtro.setorId;
    parametros['setor.id_operator'] = 'equals';
  }
  if (filtro.fluxoId) {
    parametros['fluxo.id'] = filtro.fluxoId;
    parametros['fluxo.id_operator'] = 'equals';
  }
  if (filtro.usuarioId) {
    parametros['usuarioResponsavel.id'] = filtro.usuarioId;
    parametros['usuarioResponsavel.id_operator'] = 'equals';
  }
  // Todas as situações marcadas = não precisa filtrar.
  if (filtro.situacoes.length && filtro.situacoes.length < SITUACOES_TAREFA.length) {
    parametros.situacao = filtro.situacoes.join(',');
    parametros.situacao_operator = filtro.situacoes.length === 1 ? 'equals' : 'in';
  }
  filtroData('dataInicio', filtro.dataInicio, parametros);
  filtroData('dataFinalEsperada', filtro.dataFinalEsperada, parametros);
  filtroData('dataFinalReal', filtro.dataFinalReal, parametros);

  const automacoes = comStatusReal(automacoesDoFiltro(filtro.setorId, filtro.fluxoId));
  const comAutomacao = (lista: TarefaFiltrada[]) => lista.map((t) => ({ ...t, automacaoId: automacaoDaTarefa(t)?.id ?? null }));

  // Modo "todas": lê as páginas do Lawyertool até acabar (ou até o limite) e devolve tudo junto.
  if (filtro.todas) {
    const tarefas: TarefaFiltrada[] = [];
    let total = 0;
    for (let pagina = 1; tarefas.length < LIMITE_TODAS; pagina++) {
      const resposta = await listarTarefasComFiltro<TarefaFiltrada>({ ...parametros, _page: pagina, _limit: POR_PAGINA_TODAS });
      const lista = resposta.data ?? [];
      total = resposta.total ?? total;
      tarefas.push(...lista);
      if (lista.length < POR_PAGINA_TODAS) break;
    }
    const lidas = tarefas.slice(0, LIMITE_TODAS);
    total = Math.max(total, lidas.length);
    return {
      tarefas: comAutomacao(lidas),
      total,
      pagina: 1,
      porPagina: lidas.length || 1,
      totalPaginas: 1,
      incompleta: total > lidas.length,
      automacoes,
    };
  }

  const resposta = await listarTarefasComFiltro<TarefaFiltrada>(parametros);
  const total = resposta.total ?? resposta.data?.length ?? 0;

  return {
    tarefas: comAutomacao(resposta.data ?? []),
    total,
    pagina: filtro.pagina,
    porPagina: filtro.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / filtro.porPagina)),
    incompleta: false,
    automacoes,
  };
}

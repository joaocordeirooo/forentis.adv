'use client';

import { Bot, Eye, ExternalLink, Filter, FilterX, Loader2, Minus, Play, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Campo, estiloCampo, IntervaloDatas, SeletorMultiplo } from '@/components/ui/campos-filtro';
import { Paginacao } from '@/components/ui/paginacao';
import { aplicarConfig, lerConfigColunas, salvarConfigColunas, SeletorColunas, type ConfigColunas } from '@/components/ui/seletor-colunas';
import { linkTarefaLawyertool } from '@/lib/lawyertool-link';
import { JanelaTarefaLawyertool } from './janela-tarefa-lawyertool';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { StatusCobrancaTarefa } from '@/models/cobranca-n8n.model';
import type { AutomacaoTarefa, OpcoesFiltroTarefas, SituacaoTarefa, TarefaFiltrada } from '@/models/filtro-tarefas.model';
import { normalizar } from '@/utils/texto.util';


// Filtro de tarefas no mesmo formato da tela de tarefas do Lawyertool.
// Escolhendo um setor/fluxo ligado a uma automação (config/automacoes-tarefas.config.ts), a tela mostra o que o sistema faz com elas.

interface EstadoFiltro {
  setorId: string;
  fluxoId: string;
  usuarioId: string;
  situacoes: SituacaoTarefa[];
  dataInicioDe: string;
  dataInicioAte: string;
  dataFinalEsperadaDe: string;
  dataFinalEsperadaAte: string;
  dataFinalRealDe: string;
  dataFinalRealAte: string;
}

const PADRAO: EstadoFiltro = {
  setorId: '',
  fluxoId: '',
  usuarioId: '',
  situacoes: ['pendente', 'iniciada', 'bloqueada'],
  dataInicioDe: '',
  dataInicioAte: '',
  dataFinalEsperadaDe: '',
  dataFinalEsperadaAte: '',
  dataFinalRealDe: '',
  dataFinalRealAte: '',
};

const CHAVE_STORAGE = 'forentis.filtroTarefas';
const TAMANHOS_PAGINA = [10, 25, 50] as const;
const CHAVE_POR_PAGINA = 'forentis.tarefasPorPagina';
const CHAVE_COLUNAS = 'forentis.colunasTarefas';

function lerPorPagina(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE_POR_PAGINA));
    return (TAMANHOS_PAGINA as readonly number[]).includes(n) ? n : 10;
  } catch {
    return 10;
  }
}

const ROTULO_SITUACAO: Record<SituacaoTarefa, string> = {
  pendente: 'Pendente',
  iniciada: 'Iniciada',
  bloqueada: 'Bloqueada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const COR_SITUACAO: Record<string, string> = {
  pendente: 'bg-amber-500/10 text-amber-300',
  iniciada: 'bg-sky-500/10 text-sky-300',
  bloqueada: 'bg-rose-500/10 text-rose-300',
  concluida: 'bg-emerald-500/10 text-emerald-300',
  cancelada: 'bg-zinc-500/10 text-zinc-400',
};

function lerSalvo(): EstadoFiltro {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    return bruto ? { ...PADRAO, ...JSON.parse(bruto) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

function salvar(f: EstadoFiltro) {
  try {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(f));
  } catch {
    /* sem armazenamento: o filtro só não fica lembrado */
  }
}

function montarConsulta(f: EstadoFiltro, pagina: number, porPagina: number): string {
  const p = new URLSearchParams();
  for (const campo of ['setorId', 'fluxoId', 'usuarioId', 'dataInicioDe', 'dataInicioAte', 'dataFinalEsperadaDe', 'dataFinalEsperadaAte', 'dataFinalRealDe', 'dataFinalRealAte'] as const) {
    if (f[campo]) p.set(campo, f[campo]);
  }
  if (f.situacoes.length) p.set('situacao', f.situacoes.join(','));
  p.set('pagina', String(pagina));
  p.set('porPagina', String(porPagina));
  return p.toString();
}

function dataBr(valor?: string | null): string {
  if (!valor) return '';
  const [data, hora] = valor.split(' ');
  const texto = new Date(`${data}T12:00`).toLocaleDateString('pt-BR');
  return hora ? `${texto} ${hora.slice(0, 5)}` : texto;
}

// ---- Campos ----

function SeletorSituacoes({ valor, aoMudar, opcoes }: { valor: SituacaoTarefa[]; aoMudar: (v: SituacaoTarefa[]) => void; opcoes: readonly SituacaoTarefa[] }) {
  return <SeletorMultiplo valor={valor} aoMudar={aoMudar} opcoes={opcoes.map((v) => ({ valor: v, rotulo: ROTULO_SITUACAO[v] }))} />;
}

function CartaoAutomacao({ automacao }: { automacao: AutomacaoTarefa }) {
  const ativa = automacao.status === 'ativa';
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', ativa ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/10 bg-white/[0.02]')}>
      <Bot className={cn('mt-0.5 h-5 w-5 shrink-0', ativa ? 'text-violet-300' : 'text-zinc-500')} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-100">
          {automacao.nome}
          <span className={cn('ml-2 rounded-md px-2 py-0.5 text-xs', ativa ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300')}>
            {ativa ? 'Ativa' : 'Em preparação'}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">{automacao.descricao}</p>
        {automacao.motivoInativa && <p className="mt-1 text-xs text-amber-300/90">{automacao.motivoInativa}</p>}
      </div>
    </div>
  );
}

// ---- Colunas da tabela ----

// Filtro da coluna (linha logo abaixo do título):
// 'texto' = contém o que for digitado; 'sugestoes' = texto com sugestões tiradas das tarefas carregadas;
// 'opcoes' = lista fechada (compara o valor exato).
type FiltroColuna = { tipo: 'texto'; dica?: string } | { tipo: 'sugestoes' } | { tipo: 'opcoes'; opcoes: { valor: string; rotulo: string }[] };

interface Coluna {
  id: string;
  titulo: string;
  valor: (t: TarefaFiltrada) => string;
  celula?: (t: TarefaFiltrada) => ReactNode;
  classe?: string;
  filtro: FiltroColuna;
}

const TEXTO: FiltroColuna = { tipo: 'texto' };
const SUGESTOES: FiltroColuna = { tipo: 'sugestoes' };
const DATA: FiltroColuna = { tipo: 'texto', dica: 'dd/mm' };

const COLUNAS: Coluna[] = [
  { id: 'id', titulo: '#', valor: (t) => String(t.id), classe: 'tabular-nums text-zinc-500', filtro: TEXTO },
  {
    id: 'titulo',
    titulo: 'Tarefa',
    filtro: SUGESTOES,
    valor: (t) => [t.titulo, t.tipoTarefa?.descricao].filter(Boolean).join(' · '),
    celula: (t) => (
      <div className="max-w-xs">
        <p className="truncate text-zinc-100" title={t.titulo ?? undefined}>{t.titulo || t.tipoTarefa?.descricao || '—'}</p>
        {t.titulo && t.tipoTarefa?.descricao && <p className="truncate text-xs text-zinc-500">{t.tipoTarefa.descricao}</p>}
      </div>
    ),
  },
  { id: 'cliente', titulo: 'Cliente', valor: (t) => t.emitente?.nome ?? '', filtro: TEXTO },
  { id: 'processo', titulo: 'Processo', valor: (t) => t.processo?.numeroProcesso || (t.processo?.id ? `pasta ${t.processo.id}` : ''), classe: 'tabular-nums', filtro: TEXTO },
  { id: 'setor', titulo: 'Setor', valor: (t) => t.setor?.descricao ?? '', filtro: SUGESTOES },
  { id: 'fluxo', titulo: 'Fluxo', valor: (t) => t.fluxo?.descricao ?? '', filtro: SUGESTOES },
  { id: 'responsavel', titulo: 'Responsável', valor: (t) => t.usuarioResponsavel?.nome ?? '', filtro: SUGESTOES },
  { id: 'solicitante', titulo: 'Solicitante', valor: (t) => t.usuarioSolicitante?.nome ?? '', filtro: SUGESTOES },
  {
    id: 'situacao',
    titulo: 'Situação',
    filtro: { tipo: 'opcoes', opcoes: Object.entries(ROTULO_SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo })) },
    valor: (t) => t.situacao,
    celula: (t) => <span className={cn('rounded-md px-2 py-0.5 text-xs', COR_SITUACAO[t.situacao] ?? 'bg-white/5 text-zinc-400')}>{ROTULO_SITUACAO[t.situacao as SituacaoTarefa] ?? t.situacao}</span>,
  },
  { id: 'prioridade', titulo: 'Prioridade', valor: (t) => t.prioridade ?? '', classe: 'capitalize', filtro: { tipo: 'opcoes', opcoes: ['baixa', 'media', 'alta', 'urgente'].map((v) => ({ valor: v, rotulo: v === 'media' ? 'Média' : v[0].toUpperCase() + v.slice(1) })) } },
  { id: 'inicio', titulo: 'Início', valor: (t) => dataBr(t.dataInicio), classe: 'tabular-nums', filtro: DATA },
  {
    id: 'finalEsperada',
    titulo: 'Final esperada',
    filtro: DATA,
    valor: (t) => dataBr(t.dataFinalEsperada),
    celula: (t) =>
      t.dataFinalEsperada ? (
        <span className={cn('tabular-nums', t.atrasada && 'text-rose-300')} title={t.atrasada ? `${t.diasAtraso ?? ''} dia(s) de atraso` : undefined}>
          {dataBr(t.dataFinalEsperada)}
          {t.atrasada ? <span className="ml-1 text-xs">({t.diasAtraso}d)</span> : null}
        </span>
      ) : null,
  },
  { id: 'finalReal', titulo: 'Final real', valor: (t) => dataBr(t.dataFinalReal), classe: 'tabular-nums', filtro: DATA },
];

// Campo de filtro que fica embaixo do título da coluna.
function FiltroDaColuna({ coluna, valor, sugestoes, aoMudar }: { coluna: Coluna; valor: string; sugestoes?: string[]; aoMudar: (v: string) => void }) {
  const base = cn(
    'h-8 w-full min-w-24 rounded-lg border bg-zinc-950/60 px-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500',
    valor ? 'border-violet-500/50' : 'border-white/10',
  );
  if (coluna.filtro.tipo === 'opcoes') {
    return (
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} className={base} aria-label={`Filtrar ${coluna.titulo}`}>
        <option value="">Todas</option>
        {coluna.filtro.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    );
  }
  const idLista = coluna.filtro.tipo === 'sugestoes' ? `sugestoes-${coluna.id}` : undefined;
  return (
    <div className="relative">
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        list={idLista}
        placeholder={coluna.filtro.tipo === 'texto' && coluna.filtro.dica ? coluna.filtro.dica : 'Filtrar…'}
        className={cn(base, valor && 'pr-6')}
        aria-label={`Filtrar ${coluna.titulo}`}
      />
      {valor && (
        <button type="button" onClick={() => aoMudar('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200" aria-label={`Limpar filtro de ${coluna.titulo}`}>
          <X className="h-3 w-3" />
        </button>
      )}
      {idLista && (
        <datalist id={idLista}>
          {(sugestoes ?? []).slice(0, 200).map((v) => <option key={v} value={v} />)}
        </datalist>
      )}
    </div>
  );
}

// Números de página com reticências: 1 … 4 5 [6] 7 8 … 20
const COBRANCA = 'cobranca-documentos-invalidez';

const SELO_COBRANCA: Record<StatusCobrancaTarefa['status'], { texto: string; cor: string }> = {
  aguardando_n8n: { texto: 'Enviada ao n8n', cor: 'bg-sky-500/10 text-sky-300' },
  enviada: { texto: 'Cobrança enviada', cor: 'bg-emerald-500/10 text-emerald-300' },
  falha: { texto: 'Falha na cobrança', cor: 'bg-rose-500/10 text-rose-300' },
  ignorada: { texto: 'Ignorada pelo n8n', cor: 'bg-zinc-500/10 text-zinc-400' },
};

function SeloCobranca({ status }: { status?: StatusCobrancaTarefa }) {
  if (!status) return <span className="text-xs text-zinc-600">Não cobrada pelo Forentis</span>;
  const selo = SELO_COBRANCA[status.status];
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-xs', selo.cor)} title={[status.detalhe, new Date(status.atualizadoEm).toLocaleString('pt-BR')].filter(Boolean).join('\n')}>
      {selo.texto}
    </span>
  );
}

// ---- Tela ----

export function FiltroTarefas() {
  const roteador = useRouter();
  const [atualizarOpcoes, setAtualizarOpcoes] = useState(0);
  const opcoes = useConsulta<OpcoesFiltroTarefas>(() => api.opcoesFiltroTarefas(atualizarOpcoes > 0), null, atualizarOpcoes);

  // Começa com o último filtro usado neste navegador (a tela só roda no navegador: ssr: false).
  const [filtro, setFiltro] = useState<EstadoFiltro>(lerSalvo);
  const [aplicado, setAplicado] = useState<EstadoFiltro>(filtro);
  const [pagina, setPagina] = useState(1);
  const [painelAberto, setPainelAberto] = useState(true);
  const [ocultarVazias, setOcultarVazias] = useState(true);
  // Colunas escolhidas pelo funcionário (quais e em que ordem), lembradas no navegador.
  const [configColunas, setConfigColunas] = useState<ConfigColunas | null>(() => lerConfigColunas(CHAVE_COLUNAS));
  function mudarColunas(config: ConfigColunas | null) {
    setConfigColunas(config);
    salvarConfigColunas(CHAVE_COLUNAS, config);
  }
  const [recarga, setRecarga] = useState(0);
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, string>>({});
  const [paginaLocal, setPaginaLocal] = useState(1);
  const [porPagina, setPorPagina] = useState(lerPorPagina); // 10, 25 ou 50 (lembrado no navegador)
  const filtrosAdiados = useDeferredValue(filtrosColuna); // digitação fluida mesmo com muitas linhas
  const [iniciando, setIniciando] = useState<number | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  // Tarefas marcadas (id → automação da tarefa), mantidas ao trocar de página.
  const [selecionadas, setSelecionadas] = useState<Map<number, string | null>>(new Map());
  const [executandoIa, setExecutandoIa] = useState(false);
  const [tarefaAberta, setTarefaAberta] = useState<number | null>(null);
  // Quem pede a execução (o mesmo nome usado na conferência); a tela só roda no navegador.
  const [meuNome, setMeuNome] = useState(() => {
    try {
      return localStorage.getItem('forentis.funcionario') ?? '';
    } catch {
      return '';
    }
  });
  const [confirmarCobranca, setConfirmarCobranca] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [avisoCobranca, setAvisoCobranca] = useState<string | null>(null);
  const [recargaCobranca, setRecargaCobranca] = useState(0);

  // Com filtro de coluna, traz todas as tarefas do filtro de cima (até 2.000) e filtra/pagina aqui na tela.
  const modoColunas = Object.values(filtrosColuna).some((v) => v.trim());
  const consulta = modoColunas ? `${montarConsulta(aplicado, 1, porPagina)}&todas=1` : montarConsulta(aplicado, pagina, porPagina);
  const resultado = useConsulta(() => api.filtrarTarefas(consulta), null, `${consulta}|${recarga}`);

  const mapaSetores = useMemo(() => new Map((opcoes.dados?.setores ?? []).map((s) => [s.id, s.descricao])), [opcoes.dados]);

  // Sem setor: todos os fluxos, agrupados por setor. Com setor: só os dele.
  const gruposFluxo = useMemo(() => {
    const fluxos = opcoes.dados?.fluxos ?? [];
    const lista = filtro.setorId ? fluxos.filter((f) => String(f.setorId) === filtro.setorId) : fluxos;
    const grupos = new Map<string, typeof lista>();
    for (const f of lista) {
      const nome = f.setorDescricao ?? (f.setorId ? mapaSetores.get(f.setorId) : null) ?? 'Sem setor';
      grupos.set(nome, [...(grupos.get(nome) ?? []), f]);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [opcoes.dados, filtro.setorId, mapaSetores]);

  function mudar(parcial: Partial<EstadoFiltro>) {
    setFiltro((f) => ({ ...f, ...parcial }));
  }

  function mudarSetor(setorId: string) {
    const fluxo = opcoes.dados?.fluxos.find((f) => String(f.id) === filtro.fluxoId);
    mudar({ setorId, fluxoId: fluxo && setorId && String(fluxo.setorId) !== setorId ? '' : filtro.fluxoId });
  }

  function mudarFluxo(fluxoId: string) {
    const fluxo = opcoes.dados?.fluxos.find((f) => String(f.id) === fluxoId);
    mudar({ fluxoId, ...(fluxo?.setorId && !filtro.setorId ? { setorId: String(fluxo.setorId) } : {}) });
  }

  function filtrar() {
    salvar(filtro);
    setAplicado(filtro);
    setPagina(1);
    setPaginaLocal(1);
    setRecarga((n) => n + 1);
  }

  function limpar() {
    salvar(PADRAO);
    setFiltro(PADRAO);
    setAplicado(PADRAO);
    setPagina(1);
    limparColunas();
  }

  function mudarFiltroColuna(id: string, valor: string) {
    setFiltrosColuna((f) => ({ ...f, [id]: valor }));
    setPaginaLocal(1);
  }

  function limparColunas() {
    setFiltrosColuna({});
    setPaginaLocal(1);
  }

  async function analisar(id: number) {
    setIniciando(id);
    setFalha(null);
    try {
      await api.iniciarAnalise(id);
      roteador.push('/documentos');
    } catch (e) {
      setFalha((e as Error).message);
      setIniciando(null);
    }
  }

  const dados = resultado.dados;
  const automacoesPorId = useMemo(() => new Map((opcoes.dados?.automacoes ?? []).map((a) => [a.id, a])), [opcoes.dados]);
  const colunas = useMemo(() => {
    const escolhidas = aplicarConfig(COLUNAS, configColunas);
    if (!ocultarVazias || !dados?.tarefas.length) return escolhidas;
    // Coluna com filtro digitado nunca some, senão não daria para apagar o filtro.
    return escolhidas.filter((c) => filtrosColuna[c.id]?.trim() || dados.tarefas.some((t) => c.valor(t)));
  }, [dados, ocultarVazias, filtrosColuna, configColunas]);

  // Sugestões das colunas de texto: valores distintos das tarefas carregadas.
  const sugestoes = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const c of COLUNAS) {
      if (c.filtro.tipo !== 'sugestoes') continue;
      const valores = new Set<string>();
      for (const t of dados?.tarefas ?? []) {
        const v = c.id === 'titulo' ? t.tipoTarefa?.descricao : c.valor(t);
        if (v) valores.add(v);
      }
      mapa[c.id] = [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    return mapa;
  }, [dados]);

  // Linhas depois dos filtros de coluna.
  const filtradas = useMemo(() => {
    const tarefas = dados?.tarefas ?? [];
    const ativos = COLUNAS.map((c) => ({ c, termo: filtrosAdiados[c.id]?.trim() ?? '' })).filter((x) => x.termo);
    if (!ativos.length) return tarefas;
    return tarefas.filter((t) =>
      ativos.every(({ c, termo }) => (c.filtro.tipo === 'opcoes' ? c.valor(t) === termo : normalizar(c.valor(t)).includes(normalizar(termo)))),
    );
  }, [dados, filtrosAdiados]);

  const totalPaginasLocal = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaVisivel = modoColunas ? Math.min(paginaLocal, totalPaginasLocal) : pagina;
  const totalPaginas = modoColunas ? totalPaginasLocal : dados?.totalPaginas ?? 1;
  const linhas = modoColunas ? filtradas.slice((paginaVisivel - 1) * porPagina, paginaVisivel * porPagina) : filtradas;
  const totalItens = modoColunas ? filtradas.length : dados?.total ?? 0;
  const irParaPagina = (n: number) => {
    const destino = Math.min(Math.max(1, n), totalPaginas);
    if (modoColunas) setPaginaLocal(destino);
    else setPagina(destino);
  };

  // Trocar 10/25/50 mantém a primeira tarefa que estava na tela.
  function mudarPorPagina(n: number) {
    const primeira = (paginaVisivel - 1) * porPagina;
    const novaPagina = Math.floor(primeira / n) + 1;
    setPorPagina(n);
    setPagina(modoColunas ? 1 : novaPagina);
    setPaginaLocal(modoColunas ? novaPagina : 1);
    try {
      localStorage.setItem(CHAVE_POR_PAGINA, String(n));
    } catch {
      /* sem armazenamento */
    }
  }
  const temAcao = dados?.tarefas.some((t) => t.automacaoId) ?? false;

  // ---- Cobrança pelo n8n (Setor Invalidez / Cobrar Documentos) ----
  const automacaoCobranca = automacoesPorId.get(COBRANCA);
  const cobrancaAtiva = automacaoCobranca?.status === 'ativa';
  const idsCobraveis = linhas.filter((t) => t.automacaoId === COBRANCA).map((t) => t.id);
  const chaveStatus = idsCobraveis.join(',');
  const statusConsulta = useConsulta(
    () => (chaveStatus ? api.statusCobranca(chaveStatus.split(',').map(Number)) : Promise.resolve({ configurado: false, tarefas: [] })),
    null,
    `${chaveStatus}|${recargaCobranca}`,
  );
  const statusPorTarefa = useMemo(() => new Map((statusConsulta.dados?.tarefas ?? []).map((s) => [s.tarefaId, s])), [statusConsulta.dados]);

  // ---- Seleção: qualquer tarefa com processo pode ir para a IA; as de Cobrar Documentos também para o n8n ----
  const selecionaveis = linhas.filter((t) => t.processo?.id);
  const temSelecao = selecionaveis.length > 0;
  const selecionadasVisiveis = selecionaveis.filter((t) => selecionadas.has(t.id));
  const todasMarcadas = temSelecao && selecionadasVisiveis.length === selecionaveis.length;
  const idsCobranca = [...selecionadas].filter(([, automacao]) => automacao === COBRANCA).map(([id]) => id);
  const LIMITE_IA = 50;

  function alternarSelecao(t: { id: number; automacaoId: string | null }) {
    setSelecionadas((atual) => {
      const nova = new Map(atual);
      if (nova.has(t.id)) nova.delete(t.id);
      else nova.set(t.id, t.automacaoId);
      return nova;
    });
    setConfirmarCobranca(false);
  }

  function alternarTodas() {
    setSelecionadas((atual) => {
      const nova = new Map(atual);
      for (const t of selecionaveis) {
        if (todasMarcadas) nova.delete(t.id);
        else nova.set(t.id, t.automacaoId);
      }
      return nova;
    });
    setConfirmarCobranca(false);
  }

  // A IA analisa as tarefas escolhidas e deixa os pedidos (cliente, cada empresa, não classificados) na conferência.
  async function executarIa() {
    const ids = [...selecionadas.keys()];
    if (ids.length > LIMITE_IA) {
      setFalha(`Selecione no máximo ${LIMITE_IA} tarefas por execução (há ${ids.length}).`);
      return;
    }
    const nome = meuNome.trim();
    if (nome.length < 2) {
      setFalha('Informe seu nome: é por ele que você filtra depois as tarefas que mandou a IA executar.');
      return;
    }
    try {
      localStorage.setItem('forentis.funcionario', nome);
    } catch {
      /* sem armazenamento */
    }
    setExecutandoIa(true);
    setFalha(null);
    try {
      await api.executarSelecionadas(ids, nome);
      setSelecionadas(new Map());
      roteador.push('/documentos');
    } catch (e) {
      setFalha((e as Error).message);
      setExecutandoIa(false);
    }
  }

  async function cobrar() {
    const ids = idsCobranca;
    setCobrando(true);
    setFalha(null);
    setAvisoCobranca(null);
    try {
      let nome = '';
      try {
        nome = localStorage.getItem('forentis.autorAgentes') ?? '';
      } catch {
        /* sem armazenamento */
      }
      const pedido = await api.cobrarPeloN8n(ids, nome);
      setAvisoCobranca(
        `${pedido.itens.length} tarefa(s) enviada(s) ao n8n.` + (pedido.recusadas.length ? ` ${pedido.recusadas.length} recusada(s): ${pedido.recusadas.map((r) => `#${r.tarefaId} (${r.motivo})`).join('; ')}` : ''),
      );
      setSelecionadas((atual) => {
        const nova = new Map(atual);
        for (const id of ids) nova.delete(id);
        return nova;
      });
      setRecargaCobranca((n) => n + 1);
    } catch (e) {
      setFalha((e as Error).message);
    } finally {
      setCobrando(false);
      setConfirmarCobranca(false);
    }
  }
  const alterado = JSON.stringify(filtro) !== JSON.stringify(aplicado);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/60">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Filter className="h-4 w-4 text-violet-300" /> Filtros
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAtualizarOpcoes((n) => n + 1)}
              title="Recarregar setores, fluxos e usuários do Lawyertool"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            >
              <RefreshCw className={cn('h-4 w-4', opcoes.carregando && atualizarOpcoes > 0 && 'animate-spin')} />
            </button>
            <button onClick={() => setPainelAberto((a) => !a)} aria-label={painelAberto ? 'Recolher filtros' : 'Abrir filtros'} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200">
              {painelAberto ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {painelAberto && (
          <form
            className="space-y-4 border-t border-white/5 px-4 pb-4 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              filtrar();
            }}
          >
            <AvisoErro erro={opcoes.erro} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Campo rotulo="Setor">
                <select value={filtro.setorId} onChange={(e) => mudarSetor(e.target.value)} className={estiloCampo} disabled={!opcoes.dados}>
                  <option value="">Todos os setores</option>
                  {opcoes.dados?.setores.map((s) => (
                    <option key={s.id} value={s.id}>{s.descricao}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Fluxo">
                <select value={filtro.fluxoId} onChange={(e) => mudarFluxo(e.target.value)} className={estiloCampo} disabled={!opcoes.dados || !gruposFluxo.length}>
                  <option value="">{filtro.setorId ? 'Todos os fluxos do setor' : 'Todos os fluxos'}</option>
                  {gruposFluxo.map(([setor, fluxos]) =>
                    filtro.setorId ? (
                      fluxos.map((f) => <option key={f.id} value={f.id}>{f.descricao}</option>)
                    ) : (
                      <optgroup key={setor} label={setor}>
                        {fluxos.map((f) => <option key={f.id} value={f.id}>{f.descricao}</option>)}
                      </optgroup>
                    ),
                  )}
                </select>
              </Campo>
              <Campo rotulo="Usuário responsável">
                <select value={filtro.usuarioId} onChange={(e) => mudar({ usuarioId: e.target.value })} className={estiloCampo} disabled={!opcoes.dados}>
                  <option value="">Todos os usuários</option>
                  {opcoes.dados?.usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Situação">
                <SeletorSituacoes valor={filtro.situacoes} aoMudar={(situacoes) => mudar({ situacoes })} opcoes={opcoes.dados?.situacoes ?? Object.keys(ROTULO_SITUACAO) as SituacaoTarefa[]} />
              </Campo>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <IntervaloDatas rotulo="Data início" de={filtro.dataInicioDe} ate={filtro.dataInicioAte} aoMudar={(de, ate) => mudar({ dataInicioDe: de, dataInicioAte: ate })} />
              <IntervaloDatas rotulo="Data final esperada" de={filtro.dataFinalEsperadaDe} ate={filtro.dataFinalEsperadaAte} aoMudar={(de, ate) => mudar({ dataFinalEsperadaDe: de, dataFinalEsperadaAte: ate })} />
              <IntervaloDatas rotulo="Data final real" de={filtro.dataFinalRealDe} ate={filtro.dataFinalRealAte} aoMudar={(de, ate) => mudar({ dataFinalRealDe: de, dataFinalRealAte: ate })} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <button
                  type="button"
                  role="switch"
                  aria-checked={ocultarVazias}
                  onClick={() => setOcultarVazias((v) => !v)}
                  className={cn('relative h-5 w-9 rounded-full transition-colors', ocultarVazias ? 'bg-emerald-500' : 'bg-white/15')}
                >
                  <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', ocultarVazias ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
                Ocultar colunas vazias
              </label>
              <div className="flex gap-2">
                <button type="submit" className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors', alterado ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-600/80 hover:bg-emerald-600')}>
                  <Search className="h-4 w-4" /> Filtrar
                </button>
                <button type="button" onClick={limpar} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">
                  <FilterX className="h-4 w-4" /> Limpar filtros
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {dados && dados.automacoes.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {dados.automacoes.map((a) => <CartaoAutomacao key={a.id} automacao={a} />)}
        </div>
      )}

      <AvisoErro erro={resultado.erro ?? (falha ? new Error(falha) : null)} />

      {avisoCobranca && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <span>{avisoCobranca}</span>
          <button onClick={() => setAvisoCobranca(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
        </div>
      )}

      {(temSelecao || selecionadas.size > 0) && (
        <div className={cn('sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm backdrop-blur transition-colors', selecionadas.size ? 'border-violet-500/40 bg-violet-950/60' : 'border-white/10 bg-zinc-950/60')}>
          <span className="text-zinc-300">
            {selecionadas.size
              ? `${selecionadas.size} tarefa(s) selecionada(s)${selecionadas.size > selecionadasVisiveis.length ? ` (${selecionadas.size - selecionadasVisiveis.length} em outras páginas)` : ''}`
              : 'Marque as tarefas que a IA deve analisar. Ela prepara os pedidos ao cliente e a cada empresa para a conferência; nada é enviado sem alguém conferir.'}
          </span>
          {selecionadas.size > LIMITE_IA && <span className="text-xs text-amber-300">Máximo de {LIMITE_IA} por execução.</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {selecionadas.size > 0 && (
              <button onClick={() => { setSelecionadas(new Map()); setConfirmarCobranca(false); }} className="text-xs text-zinc-400 hover:text-zinc-200">Limpar seleção</button>
            )}
            {idsCobranca.length > 0 && (confirmarCobranca ? (
              <>
                <span className="text-xs text-amber-200">O n8n vai mandar WhatsApp para {idsCobranca.length} cliente(s). Confirmar?</span>
                <button onClick={cobrar} disabled={cobrando} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
                  {cobrando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirmar
                </button>
                <button onClick={() => setConfirmarCobranca(false)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 hover:bg-white/5">Cancelar</button>
              </>
            ) : (
              <button
                onClick={() => setConfirmarCobranca(true)}
                disabled={!cobrancaAtiva}
                title={!cobrancaAtiva ? automacaoCobranca?.motivoInativa ?? 'Integração com o n8n desligada.' : 'Só as tarefas de Cobrar Documentos (Invalidez)'}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-200 ring-1 ring-white/15 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" /> Cobrar pelo n8n ({idsCobranca.length})
              </button>
            ))}
            {selecionadas.size > 0 && (
              <input
                value={meuNome}
                onChange={(e) => setMeuNome(e.target.value)}
                placeholder="Seu nome"
                aria-label="Seu nome (quem pede a execução)"
                className="h-8 w-40 rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-zinc-100 outline-none focus:border-violet-500"
              />
            )}
            <button
              onClick={executarIa}
              disabled={!selecionadas.size || selecionadas.size > LIMITE_IA || executandoIa || meuNome.trim().length < 2}
              title={meuNome.trim().length < 2 ? 'Informe seu nome' : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {executandoIa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />} Executar IA{selecionadas.size ? ` (${selecionadas.size})` : ''}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-400">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {!dados
            ? 'Carregando…'
            : modoColunas
              ? `${filtradas.length.toLocaleString('pt-BR')} de ${dados.total.toLocaleString('pt-BR')} tarefa(s)`
              : `${dados.total.toLocaleString('pt-BR')} tarefa(s)`}
          {resultado.carregando && dados && <Loader2 className="inline h-3.5 w-3.5 animate-spin" />}
          {modoColunas && dados?.incompleta && (
            <span className="text-xs text-amber-300">Filtros das colunas aplicados às primeiras {dados.tarefas.length.toLocaleString('pt-BR')}: refine o filtro de cima.</span>
          )}
          {modoColunas && (
            <button onClick={limparColunas} className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">
              <X className="h-3 w-3" /> Limpar filtros das colunas
            </button>
          )}
        </span>
        <SeletorColunas colunas={COLUNAS} config={configColunas} aoMudar={mudarColunas} />
      </div>

      {resultado.carregando && !dados ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Esqueleto key={i} className="h-12" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/80">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                {temSelecao && (
                  <th rowSpan={2} className="w-10 px-3 align-top pt-2.5">
                    <input type="checkbox" checked={todasMarcadas} onChange={alternarTodas} className="h-4 w-4 accent-violet-500" aria-label="Selecionar todas as tarefas da página" />
                  </th>
                )}
                {colunas.map((c) => <th key={c.id} className="px-3 py-2.5 font-medium">{c.titulo}</th>)}
                {temAcao && <th className="px-3 py-2.5 font-medium">Automação</th>}
                <th rowSpan={2} className="px-3 py-2.5 align-top font-medium">Abrir</th>
              </tr>
              <tr className="border-t border-white/5 normal-case tracking-normal">
                {colunas.map((c) => (
                  <th key={c.id} className="px-2 pb-2 pt-1 font-normal">
                    <FiltroDaColuna coluna={c} valor={filtrosColuna[c.id] ?? ''} sugestoes={sugestoes[c.id]} aoMudar={(v) => mudarFiltroColuna(c.id, v)} />
                  </th>
                ))}
                {temAcao && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {linhas.map((t) => {
                const automacao = t.automacaoId ? automacoesPorId.get(t.automacaoId) : undefined;
                return (
                  <tr
                    key={t.id}
                    onClick={(e) => {
                      // Clique na linha abre a tarefa (menos em caixas de marcação, botões e links).
                      if ((e.target as HTMLElement).closest('input, button, a, select, label')) return;
                      setTarefaAberta(t.id);
                    }}
                    className={cn('cursor-pointer transition-colors hover:bg-white/[0.03]', t.destaca && 'bg-amber-500/[0.04]', selecionadas.has(t.id) && 'bg-violet-500/[0.06]')}>
                    {temSelecao && (
                      <td className="px-3 py-2">
                        {t.processo?.id ? (
                          <input type="checkbox" checked={selecionadas.has(t.id)} onChange={() => alternarSelecao(t)} className="h-4 w-4 accent-violet-500" aria-label={`Selecionar tarefa ${t.id}`} />
                        ) : (
                          <span title="Tarefa sem processo: a IA não tem o que ler" className="text-zinc-700">—</span>
                        )}
                      </td>
                    )}
                    {colunas.map((c) => (
                      <td key={c.id} className={cn('whitespace-nowrap px-3 py-2 text-zinc-300', c.classe)}>
                        {c.celula ? c.celula(t) : c.valor(t) || <span className="text-zinc-600">—</span>}
                      </td>
                    ))}
                    {temAcao && (
                      <td className="whitespace-nowrap px-3 py-2">
                        {automacao?.status === 'ativa' && automacao.id === 'solicitacao-documentos' ? (
                          <button
                            onClick={() => analisar(t.id)}
                            disabled={iniciando !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-sky-200 ring-1 ring-white/10 hover:bg-sky-500/15 disabled:opacity-50"
                          >
                            {iniciando === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Analisar
                          </button>
                        ) : automacao?.id === COBRANCA ? (
                          <SeloCobranca status={statusPorTarefa.get(t.id)} />
                        ) : automacao ? (
                          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300" title={automacao.descricao}>{automacao.nome} · em preparação</span>
                        ) : null}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="flex items-center gap-1">
                        <button onClick={() => setTarefaAberta(t.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" title="Ver a tarefa na íntegra">
                          <Eye className="h-4 w-4" />
                        </button>
                        <a href={linkTarefaLawyertool(t.id)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-zinc-400 hover:bg-violet-500/15 hover:text-violet-200" title="Abrir no Lawyertool">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {dados && !linhas.length && (
                <tr>
                  <td colSpan={colunas.length + 2 + (temSelecao ? 1 : 0)} className="px-4 py-10 text-center text-zinc-500">Nenhuma tarefa neste filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dados && totalItens > 0 && (
        <Paginacao tamanhos={TAMANHOS_PAGINA} pagina={paginaVisivel} totalPaginas={totalPaginas} porPagina={porPagina} totalItens={totalItens} aoIr={irParaPagina} aoMudarPorPagina={mudarPorPagina} />
      )}
      <JanelaTarefaLawyertool tarefaId={tarefaAberta} aoFechar={() => setTarefaAberta(null)} />
    </div>
  );
}

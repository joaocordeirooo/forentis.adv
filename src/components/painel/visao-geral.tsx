'use client';

import { LayoutGroup, motion } from 'motion/react';
import { ArrowRight, Building2, CircleHelp, Layers, ListFilter, MessageCircle, Send, ShieldAlert, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Contador } from '@/components/ui/contador';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api, type ExecucaoCompleta } from '@/lib/api-client';
import { Paginacao } from '@/components/ui/paginacao';
import { cn } from '@/lib/utils';
import type { Solicitacao } from '@/models/solicitacao.model';
import { AnaliseAoVivo } from './analise-ao-vivo';
import { agruparPorTarefa, JanelaTarefa, ListaTarefasExecutadas } from './conferencia-por-tarefa';
import { DetalheSolicitacao } from './detalhe-solicitacao';
import { FluxoAnimado } from './fluxo-animado';
import { STATUS_ABERTOS_PAINEL } from './tipo-solicitacao';

const SEM_SETOR = 'sem-setor';
const SEM_NOME = '__automatica'; // pedidos de execuções sem nome (agenda ou "analisar todas")
const CHAVE_PEDIDO_POR = 'forentis.visaoPedidoPor';

function lerPedidoPor(): string {
  try {
    return localStorage.getItem(CHAVE_PEDIDO_POR) ?? '';
  } catch {
    return '';
  }
}

interface ResumoSetor {
  chave: string;
  nome: string;
  conferir: number; // pedidos abertos (cliente + empresa + não classificados)
  cliente: number;
  empresa: number;
  indefinidas: number;
  bloqueadas: number;
  tarefas: number; // tarefas com algo aberto
  enviadas: number;
  lista: Solicitacao[];
}

const chaveSetor = (s: Solicitacao) => (s.origem?.setor ? String(s.origem.setor.id) : SEM_SETOR);

function resumirPorSetor(lista: Solicitacao[]): ResumoSetor[] {
  const mapa = new Map<string, ResumoSetor>();
  for (const s of lista) {
    const chave = chaveSetor(s);
    if (!mapa.has(chave)) {
      mapa.set(chave, { chave, nome: s.origem?.setor?.descricao ?? 'Sem setor', conferir: 0, cliente: 0, empresa: 0, indefinidas: 0, bloqueadas: 0, tarefas: 0, enviadas: 0, lista: [] });
    }
    const r = mapa.get(chave)!;
    r.lista.push(s);
    if (STATUS_ABERTOS_PAINEL.includes(s.status)) {
      r.conferir++;
      if (s.tipo === 'cliente') r.cliente++;
      else if (s.tipo === 'empresa') r.empresa++;
      else r.indefinidas++;
      if (s.status === 'bloqueada') r.bloqueadas++;
    }
    if (s.status === 'concluida' && s.tipo !== 'indefinida') r.enviadas++;
  }
  for (const r of mapa.values()) {
    r.tarefas = new Set(r.lista.filter((s) => STATUS_ABERTOS_PAINEL.includes(s.status)).map((s) => s.tarefaId)).size;
  }
  return [...mapa.values()].sort((a, b) => b.conferir - a.conferir || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function CartaoSetor({ r, ativo, aoEscolher }: { r: ResumoSetor; ativo: boolean; aoEscolher: () => void }) {
  return (
    <button onClick={aoEscolher} className={cn('relative w-full rounded-2xl border p-4 text-left transition', ativo ? 'border-violet-500/50' : 'border-white/10 hover:border-white/20')}>
      {ativo && <motion.span layoutId="setor-ativo" className="absolute inset-0 rounded-2xl bg-violet-500/10" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
      <span className="relative block">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold text-white"><Layers className="h-4 w-4 text-violet-300" /> {r.nome}</span>
          {r.bloqueadas > 0 && <span className="inline-flex items-center gap-1 text-xs text-amber-300"><ShieldAlert className="h-3.5 w-3.5" /> {r.bloqueadas}</span>}
        </span>
        <span className="mt-3 flex items-end gap-2">
          <Contador valor={r.conferir} className="text-3xl font-semibold tabular-nums text-white" />
          <span className="pb-1 text-xs text-zinc-400">para conferir · {r.tarefas} tarefa(s)</span>
        </span>
        <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-emerald-300" /> {r.cliente} cliente</span>
          <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-indigo-300" /> {r.empresa} empresa</span>
          {r.indefinidas > 0 && <span className="inline-flex items-center gap-1"><CircleHelp className="h-3.5 w-3.5 text-amber-300" /> {r.indefinidas} a classificar</span>}
          <span className="inline-flex items-center gap-1"><Send className="h-3.5 w-3.5 text-zinc-500" /> {r.enviadas} enviados</span>
        </span>
      </span>
    </button>
  );
}

export function VisaoGeral() {
  const [aberta, setAberta] = useState<string | null>(null);
  const [setorEscolhido, setSetorEscolhido] = useState<string | null>(null);
  // Filtro "Pedido por": o funcionário vê só as tarefas que ele mandou a IA executar (a tela só roda no navegador).
  const [pedidoPor, setPedidoPor] = useState(lerPedidoPor);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [tipoTarefa, setTipoTarefa] = useState(''); // '' = todos os tipos
  const [tarefaAberta, setTarefaAberta] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  function escolherPedidoPor(valor: string) {
    setPedidoPor(valor);
    try {
      localStorage.setItem(CHAVE_PEDIDO_POR, valor);
    } catch {
      /* sem armazenamento */
    }
  }
  // A lista de execuções é leve; o detalhe da última só é buscado de 3 em 3 s enquanto ela está rodando.
  const execucoes = useConsulta(api.execucoes, 15_000);
  const ultima = execucoes.dados?.[0] ?? null;
  const rodando = ultima?.status === 'em_andamento';
  const execucao = useConsulta<ExecucaoCompleta | null>(
    () => (ultima ? api.execucao(ultima.id) : Promise.resolve(null)),
    rodando ? 3_000 : null,
    `${ultima?.id}-${ultima?.status}`,
  );
  const solicitacoes = useConsulta(api.solicitacoes, rodando ? 10_000 : 30_000);
  const tarefas = useConsulta(() => api.tarefas(), null);

  const todas = useMemo(() => solicitacoes.dados ?? [], [solicitacoes.dados]);
  const nomes = useMemo(
    () => [...new Set(todas.map((s) => s.solicitadoPor).filter((n): n is string => Boolean(n)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
    [todas],
  );
  const lista = useMemo(() => {
    const filtrada = !pedidoPor ? todas : todas.filter((s) => (pedidoPor === SEM_NOME ? !s.solicitadoPor : s.solicitadoPor === pedidoPor));
    return filtrada;
  }, [todas, pedidoPor]);
  const setores = useMemo(() => resumirPorSetor(lista), [lista]);
  const setor = setores.find((r) => r.chave === setorEscolhido) ?? setores[0] ?? null;
  const gruposSetor = useMemo(() => (setor ? agruparPorTarefa(setor.lista, mostrarConcluidas) : []), [setor, mostrarConcluidas]);
  // Tipos de tarefa presentes no setor (com quantas pastas cada um tem).
  const tiposTarefa = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const g of gruposSetor) mapa.set(g.tipoTarefa, (mapa.get(g.tipoTarefa) ?? 0) + 1);
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [gruposSetor]);
  const tipoValido = tiposTarefa.some(([t]) => t === tipoTarefa) ? tipoTarefa : '';
  const grupos = useMemo(() => (tipoValido ? gruposSetor.filter((g) => g.tipoTarefa === tipoValido) : gruposSetor), [gruposSetor, tipoValido]);
  const totalPaginas = Math.max(1, Math.ceil(grupos.length / porPagina));
  const paginaVisivel = Math.min(pagina, totalPaginas);
  const visiveis = grupos.slice((paginaVisivel - 1) * porPagina, paginaVisivel * porPagina);
  // A janela usa a lista inteira (não só o filtro), para continuar aberta enquanto o funcionário conclui os pedidos.
  const grupoAberto = useMemo(
    () => (tarefaAberta === null ? null : agruparPorTarefa(lista, true).find((g) => g.tarefaId === tarefaAberta) ?? null),
    [lista, tarefaAberta],
  );

  const abertas = lista.filter((s) => STATUS_ABERTOS_PAINEL.includes(s.status));
  const numeros = {
    tarefas: tarefas.dados?.total ?? null,
    analisadas: execucao.dados?.tarefasProcessadas ?? 0,
    cliente: abertas.filter((s) => s.tipo === 'cliente').length,
    empresa: abertas.filter((s) => s.tipo === 'empresa').length,
    conferencia: abertas.length,
    enviadas: lista.filter((s) => s.status === 'concluida' && s.tipo !== 'indefinida').length,
    analisando: execucao.dados?.status === 'em_andamento',
  };

  return (
    <div className="space-y-8">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mb-2 text-sm font-medium text-violet-300">Estação · Solicitação de documentos</p>
        <h1 className="max-w-3xl bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-5xl">
          Do Lawyertool ao pedido pronto para enviar.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          A IA prepara, separado por destinatário, o que pedir ao cliente e a cada empresa. A equipe confere, ajusta, anexa e envia.
        </p>
      </motion.section>

      <AvisoErro erro={execucoes.erro ?? solicitacoes.erro} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-white">Por setor</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <UserRound className="h-4 w-4 text-violet-300" /> Pedido por
              <select
                value={pedidoPor}
                onChange={(e) => escolherPedidoPor(e.target.value)}
                className={cn('h-9 rounded-xl border bg-zinc-900/80 px-3 text-sm text-zinc-100 outline-none focus:border-violet-500', pedidoPor ? 'border-violet-500/50' : 'border-white/10')}
              >
                <option value="">Todos</option>
                {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
                {pedidoPor && pedidoPor !== SEM_NOME && !nomes.includes(pedidoPor) && <option value={pedidoPor}>{pedidoPor}</option>}
                <option value={SEM_NOME}>Execução automática / sem nome</option>
              </select>
            </label>
            <Link href="/documentos/tarefas" className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200">
              Escolher tarefas para a IA <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {solicitacoes.carregando ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-36" />)}</div>
        ) : setores.length ? (
          <LayoutGroup id="setores">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {setores.map((r) => <CartaoSetor key={r.chave} r={r} ativo={setor?.chave === r.chave} aoEscolher={() => setSetorEscolhido(r.chave)} />)}
            </div>
          </LayoutGroup>
        ) : (
          <div className="grid h-32 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">
            {pedidoPor ? 'Nenhum pedido para este filtro.' : 'Nenhuma solicitação ainda. Escolha tarefas na aba Tarefas e execute a IA.'}
          </div>
        )}
      </section>

      {setor && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-white">
              {setor.nome} · <span className="text-zinc-400">{grupos.length} tarefa(s){mostrarConcluidas ? '' : ' para conferir'}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <ListFilter className="h-4 w-4 text-violet-300" /> Tipo de tarefa
                <select
                  value={tipoValido}
                  onChange={(e) => { setTipoTarefa(e.target.value); setPagina(1); }}
                  className={cn('h-9 max-w-80 rounded-xl border bg-zinc-900/80 px-3 text-sm text-zinc-100 outline-none focus:border-violet-500', tipoValido ? 'border-violet-500/50' : 'border-white/10')}
                >
                  <option value="">Todos ({gruposSetor.length})</option>
                  {tiposTarefa.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
                </select>
              </label>
              <div className="inline-flex rounded-xl border border-white/10 p-1 text-sm">
                {([[false, 'Para conferir'], [true, 'Todas']] as const).map(([valor, rotulo]) => (
                  <button key={rotulo} onClick={() => { setMostrarConcluidas(valor); setPagina(1); }} className={cn('rounded-lg px-3 py-1 transition-colors', mostrarConcluidas === valor ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200')}>
                    {rotulo}
                  </button>
                ))}
              </div>
              <Link href="/documentos/solicitacoes" className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200">
                Todas as solicitações <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <ListaTarefasExecutadas
            grupos={visiveis}
            aoAbrir={setTarefaAberta}
            vazio={tipoValido ? 'Nenhuma tarefa deste tipo neste setor.' : mostrarConcluidas ? 'Nenhuma tarefa neste setor.' : 'Nada aguardando conferência neste setor.'}
          />
          {grupos.length > 10 && (
            <Paginacao tamanhos={[10, 25, 50]} pagina={paginaVisivel} totalPaginas={totalPaginas} porPagina={porPagina} totalItens={grupos.length} aoIr={(n) => setPagina(Math.min(Math.max(1, n), totalPaginas))} aoMudarPorPagina={(n) => { setPorPagina(n); setPagina(1); }} />
          )}
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-6">
        <FluxoAnimado numeros={numeros} />
      </section>

      <div className="max-w-2xl">
        {execucoes.carregando ? <Esqueleto className="h-64" /> : <AnaliseAoVivo execucao={execucao.dados} aoIniciar={execucoes.recarregar} />}
      </div>

      <JanelaTarefa grupo={grupoAberto} aoFechar={() => setTarefaAberta(null)} aoAbrirPedido={setAberta} />
      <DetalheSolicitacao id={aberta} aoFechar={() => setAberta(null)} aoMudar={solicitacoes.recarregar} />
    </div>
  );
}

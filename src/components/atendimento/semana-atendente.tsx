'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, FlaskConical, Loader2, Lock, MapPin, PackageCheck, RefreshCw, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { BotaoBrilho } from '@/components/ui/botao-brilho';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Atendente, ResultadoMaterialColetado, TarefaAtendimento } from '@/models/atendimento.model';

const CORES_SETOR: Record<string, string> = {
  'Setor Invalidez': 'bg-rose-400',
  Revisão: 'bg-violet-400',
  'Arquivo Central': 'bg-amber-400',
  'Arquivo Administrativo': 'bg-sky-400',
  Financeiro: 'bg-emerald-400',
  Judicial: 'bg-indigo-400',
  'Setor de Cálculos - Ações Novas': 'bg-teal-400',
};

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Segunda-feira da semana de uma data AAAA-MM-DD.
function semanaDoDia(data: string) {
  const d = new Date(`${data}T12:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString('en-CA');
}

// Soma dias a uma data AAAA-MM-DD.
function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00`);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}
function diaCurto(data: string) {
  const d = new Date(`${data}T12:00`);
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Caixa({ marcada, parcial, aoMudar, rotulo }: { marcada: boolean; parcial?: boolean; aoMudar: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={parcial ? 'mixed' : marcada}
      aria-label={rotulo}
      onClick={(e) => {
        e.stopPropagation();
        aoMudar();
      }}
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors',
        marcada || parcial ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/25 bg-black/30 hover:border-white/50',
      )}
    >
      {marcada && <Check className="h-4 w-4" strokeWidth={3} />}
      {!marcada && parcial && <span className="h-0.5 w-3 rounded bg-white" />}
    </button>
  );
}

function LinhaTarefa({ t, marcada, aoMudar, hoje, selecionavel }: { t: TarefaAtendimento; marcada: boolean; aoMudar: () => void; hoje: string; selecionavel: boolean }) {
  const atrasada = t.situacao === 'pendente' && t.prazo < hoje;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      onClick={selecionavel ? aoMudar : undefined}
      className={cn('flex gap-3 px-4 py-3 transition-colors', selecionavel && 'cursor-pointer', marcada ? 'bg-emerald-500/[0.07]' : 'hover:bg-white/[0.03]')}
    >
      {selecionavel && (
        <div className="pt-0.5">
          <Caixa marcada={marcada} aoMudar={aoMudar} rotulo={`Selecionar ${t.cliente}`} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium text-zinc-100">{t.cliente}</p>
          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px]', t.prazo === hoje ? 'bg-violet-500/15 text-violet-200' : atrasada ? 'bg-rose-500/15 text-rose-200' : 'bg-white/5 text-zinc-400')}>
            {t.prazo === hoje ? 'Hoje' : diaCurto(t.prazo)}
            {atrasada ? ' · atrasada' : ''}
          </span>
          {t.tarefaId && !t.exemplo && <span className="text-[11px] tabular-nums text-zinc-600">#{t.tarefaId}</span>}
          {t.exemplo && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-300">exemplo</span>}
          {t.tarefaFinal === false && (
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-400" title="O tipo exige criar a próxima tarefa ao concluir">
              concluir pelo Lawyertool
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">{t.tipo}</p>
        <p className="mt-1 text-sm text-zinc-300">{t.descricao}</p>
        {(t.cidade || t.processo) && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" /> {t.cidade ?? 'cidade não informada'}
            {t.processo ? ` · ${t.processo}` : ''}
          </p>
        )}
      </div>
    </motion.li>
  );
}

function ListaResolvidas({ titulo, icone, tarefas, data }: { titulo: string; icone: React.ReactNode; tarefas: TarefaAtendimento[]; data: (t: TarefaAtendimento) => string | null | undefined }) {
  const [aberta, setAberta] = useState(false);
  if (!tarefas.length) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/50">
      <button onClick={() => setAberta(!aberta)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {icone}
        <span className="flex-1 text-sm text-zinc-300">{titulo} ({tarefas.length})</span>
        <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', aberta && 'rotate-180')} />
      </button>
      {aberta && (
        <ul className="divide-y divide-white/5 border-t border-white/5">
          {tarefas.map((t) => {
            const quando = data(t);
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', CORES_SETOR[t.setor] ?? 'bg-zinc-400')} />
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  {t.cliente} · <span className="text-zinc-500">{t.tipo}</span>
                  {t.tarefaId && !t.exemplo && <span className="text-zinc-600"> · #{t.tarefaId}</span>}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {quando ? new Date(quando.replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : diaCurto(t.prazo)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SeletorFuncionario({ atendentes, atual, aoEscolher }: { atendentes: Atendente[]; atual: string | null; aoEscolher: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {atendentes.map((a) => (
        <button
          key={a.id}
          onClick={() => aoEscolher(a.id)}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
            a.id === atual ? 'border-emerald-400/60 bg-emerald-500/15 text-white' : 'border-white/10 text-zinc-300 hover:bg-white/5',
          )}
        >
          {a.ficticio ? <FlaskConical className="h-3.5 w-3.5 text-amber-300" /> : a.liberado ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> : null}
          <span>{a.ficticio ? 'Exemplo (fictício)' : a.nome}</span>
          {!a.ficticio && <span className="rounded-md bg-white/10 px-1.5 text-xs tabular-nums text-zinc-300">{a.abertas ?? 0}</span>}
        </button>
      ))}
    </div>
  );
}

export function SemanaAtendente() {
  const [atendenteEscolhido, setAtendenteEscolhido] = useState('');
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null); // null = semana atual
  const { dados, erro, carregando, recarregar } = useConsulta(
    () => api.atendimento({ atendenteId: atendenteEscolhido || undefined, ...(periodo ?? {}) }),
    null,
    `${atendenteEscolhido}|${periodo?.inicio}|${periodo?.fim}`,
  );
  const atendente = dados?.atendente ?? null;
  const atendenteId = atendente?.id ?? '';
  const podeExecutar = Boolean(atendente && (atendente.ficticio || atendente.liberado));
  const [atualizando, setAtualizando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoMaterialColetado[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const tarefas = dados?.tarefas ?? [];
  const pendentes = tarefas.filter((t) => t.situacao === 'pendente');
  const iniciadas = tarefas.filter((t) => t.situacao === 'iniciada');
  const concluidas = tarefas.filter((t) => t.situacao === 'concluida');
  const hoje = dados ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '';

  const porSetor = useMemo(() => {
    const grupos = new Map<string, TarefaAtendimento[]>();
    for (const t of pendentes) grupos.set(t.setor, [...(grupos.get(t.setor) ?? []), t]);
    return [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [pendentes]);

  const alternar = (id: string) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });

  const alternarSetor = (lista: TarefaAtendimento[]) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      const todas = lista.every((t) => nova.has(t.id));
      for (const t of lista) {
        if (todas) nova.delete(t.id);
        else nova.add(t.id);
      }
      return nova;
    });

  async function confirmar() {
    setEnviando(true);
    setFalha(null);
    try {
      if (!atendenteId) return;
      const resposta = await api.materialColetado(atendenteId, [...selecionadas]);
      setResultados(resposta.resultados);
      setSelecionadas(new Set());
      setConfirmando(false);
      await recarregar();
    } catch (e) {
      setFalha((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function recriar() {
    setResultados(null);
    setSelecionadas(new Set());
    await api.recriarExemplos(atendenteId);
    await recarregar();
  }

  // periodo: undefined = mantém; null = volta para a semana atual.
  function trocar(mudanca: { atendente?: string; periodo?: { inicio: string; fim: string } | null }) {
    setSelecionadas(new Set());
    setResultados(null);
    if (mudanca.atendente !== undefined) setAtendenteEscolhido(mudanca.atendente);
    if (mudanca.periodo !== undefined) setPeriodo(mudanca.periodo);
  }

  // Muda uma das pontas do período; se ficar invertido, a outra ponta acompanha.
  function mudarData(ponta: 'inicio' | 'fim', valor: string) {
    if (!dados || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return;
    let { inicio, fim } = dados.semana;
    if (ponta === 'inicio') {
      inicio = valor;
      if (fim < inicio) fim = inicio;
    } else {
      fim = valor;
      if (inicio > fim) inicio = fim;
    }
    trocar({ periodo: { inicio, fim } });
  }

  // Busca de novo no Lawyertool, sem o cache de 1 minuto do servidor.
  async function atualizar() {
    setAtualizando(true);
    try {
      await api.atendimento({ atendenteId: atendenteId || undefined, ...(periodo ?? {}), atualizar: true });
      await recarregar();
    } finally {
      setAtualizando(false);
    }
  }

  const escolhidas = tarefas.filter((t) => selecionadas.has(t.id));
  const progresso = tarefas.length ? Math.round((concluidas.length / tarefas.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-medium text-emerald-300">Atendimento externo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tarefas da semana</h1>
          {dados && (
            <p className="mt-1 text-zinc-400">
              {atendente ? (atendente.ficticio ? 'Exemplo (fictício)' : atendente.nome) : 'Nenhum funcionário com tarefas'} · {diaCurto(dados.semana.inicio)} a {diaCurto(dados.semana.fim)}{periodo ? ' (período escolhido)' : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dados && !atendente?.ficticio && (
            <>
              <div className="flex items-center gap-1 rounded-xl border border-white/10 px-2 py-1 text-sm text-zinc-400">
                <label className="flex items-center gap-1">
                  De
                  <input
                    type="date"
                    value={dados.semana.inicio}
                    onChange={(e) => mudarData('inicio', e.target.value)}
                    className="rounded-lg bg-black/30 px-2 py-1 text-zinc-100 [color-scheme:dark]"
                  />
                </label>
                <label className="flex items-center gap-1">
                  até
                  <input
                    type="date"
                    value={dados.semana.fim}
                    min={dados.semana.inicio}
                    onChange={(e) => mudarData('fim', e.target.value)}
                    className="rounded-lg bg-black/30 px-2 py-1 text-zinc-100 [color-scheme:dark]"
                  />
                </label>
              </div>
              <div className="flex items-center rounded-xl border border-white/10">
                <button
                  onClick={() => trocar({ periodo: { inicio: somarDias(semanaDoDia(dados.semana.inicio), -7), fim: somarDias(semanaDoDia(dados.semana.inicio), -1) } })}
                  className="rounded-l-xl p-2 text-zinc-300 hover:bg-white/5"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => trocar({ periodo: null })}
                  disabled={!periodo}
                  className="px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:text-zinc-600 disabled:hover:bg-transparent"
                >
                  Esta semana
                </button>
                <button
                  onClick={() => trocar({ periodo: { inicio: somarDias(semanaDoDia(dados.semana.inicio), 7), fim: somarDias(semanaDoDia(dados.semana.inicio), 13) } })}
                  className="rounded-r-xl p-2 text-zinc-300 hover:bg-white/5"
                  aria-label="Próxima semana"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          {atendente?.ficticio ? (
            <button onClick={recriar} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">
              <RotateCcw className="h-4 w-4" /> Recriar exemplos
            </button>
          ) : (
            <button onClick={atualizar} disabled={atualizando} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">
              <RefreshCw className={cn('h-4 w-4', atualizando && 'animate-spin')} /> Atualizar
            </button>
          )}
        </div>
      </div>

      {dados && dados.atendentes.length > 0 && (
        <SeletorFuncionario atendentes={dados.atendentes} atual={atendenteId || null} aoEscolher={(id) => trocar({ atendente: id, periodo: id === 'teste' ? null : undefined })} />
      )}

      {atendente?.ficticio && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>Modo de exemplo: atendente e tarefas fictícios. &quot;Material coletado&quot; inicia as tarefas só aqui — nada é alterado no Lawyertool.</span>
        </div>
      )}
      {atendente && !atendente.ficticio && !atendente.liberado && (
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <span>Só visualização: a execução no Lawyertool (iniciar e concluir) está liberada apenas para os funcionários em teste.</span>
        </div>
      )}
      {atendente?.liberado && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <span>
            &quot;Material coletado&quot; inicia as tarefas marcadas <strong>no Lawyertool</strong>. Ao atender cada cliente, o funcionário avisa a DEX e ela conclui a tarefa.
          </span>
        </div>
      )}
      {dados?.buscaIncompleta && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">A busca no Lawyertool passou do limite de páginas: a lista pode estar incompleta.</div>
      )}

      {dados && atendente && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-300">
              {pendentes.length} pendente(s) · {iniciadas.length} iniciada(s) · {concluidas.length} concluída(s)
            </span>
            <span className="tabular-nums text-zinc-500">{progresso}% concluído</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" initial={false} animate={{ width: `${progresso}%` }} transition={{ type: 'spring', stiffness: 80, damping: 20 }} />
          </div>
        </div>
      )}

      <AvisoErro erro={erro ?? (falha ? new Error(falha) : null)} />

      <AnimatePresence>
        {resultados && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 font-medium text-emerald-200">
                <PackageCheck className="h-5 w-5" /> {resultados.filter((r) => r.ok).length} tarefa(s) iniciada(s)
              </p>
              <button onClick={() => setResultados(null)} className="rounded-lg p-1 text-emerald-200/70 hover:bg-white/10" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {resultados.map((r) => (
                <li key={r.id} className={r.ok ? 'text-emerald-100/90' : 'text-rose-200'}>
                  {r.ok ? '✓' : '✗'} {r.cliente} — {r.titulo}: {r.mensagem}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {carregando ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-40" />)}</div>
      ) : (
        <div className="space-y-4">
          {porSetor.map(([setor, lista]) => {
            const marcadas = lista.filter((t) => selecionadas.has(t.id)).length;
            return (
              <section key={setor} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80">
                <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                  {podeExecutar && (
                    <Caixa marcada={marcadas === lista.length} parcial={marcadas > 0 && marcadas < lista.length} aoMudar={() => alternarSetor(lista)} rotulo={`Selecionar todas de ${setor}`} />
                  )}
                  <span className={cn('h-2 w-2 rounded-full', CORES_SETOR[setor] ?? 'bg-zinc-400')} />
                  <h2 className="flex-1 font-medium text-zinc-100">{setor}</h2>
                  <span className="text-xs tabular-nums text-zinc-500">{marcadas ? `${marcadas}/` : ''}{lista.length}</span>
                </header>
                <ul className="divide-y divide-white/5">
                  <AnimatePresence initial={false}>
                    {lista.map((t) => <LinhaTarefa key={t.id} t={t} hoje={hoje} selecionavel={podeExecutar} marcada={selecionadas.has(t.id)} aoMudar={() => alternar(t.id)} />)}
                  </AnimatePresence>
                </ul>
              </section>
            );
          })}
          {!pendentes.length && (
            <div className="grid h-32 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">Nenhuma tarefa pendente neste período para este funcionário.</div>
          )}

          <ListaResolvidas titulo="Iniciadas (material coletado)" icone={<PackageCheck className="h-4 w-4 text-emerald-400" />} tarefas={iniciadas} data={(t) => t.iniciadaEm} />
          <ListaResolvidas titulo="Concluídas" icone={<CheckCheck className="h-4 w-4 text-sky-400" />} tarefas={concluidas} data={(t) => t.concluidaEm} />
        </div>
      )}

      {/* Barra fixa: aparece quando há tarefas selecionadas */}
      <AnimatePresence>
        {podeExecutar && selecionadas.size > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950 px-4 py-3 sm:px-6"
          >
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-zinc-300">
                <span className="font-semibold text-white">{selecionadas.size}</span> tarefa(s) selecionada(s)
              </p>
              <button onClick={() => setSelecionadas(new Set())} className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5">
                Limpar
              </button>
              <BotaoBrilho variante="sucesso" onClick={() => setConfirmando(true)}>
                <PackageCheck className="h-4 w-4" /> Material coletado
              </BotaoBrilho>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmação */}
      <AnimatePresence>
        {confirmando && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !enviando && setConfirmando(false)} />
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="pointer-events-auto max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-white">Confirmar material coletado</h3>
              <p className="mt-1 text-sm text-zinc-400">
                As {escolhidas.length} tarefas abaixo serão iniciadas{atendente?.ficticio ? ' (exemplo, sem alterar o Lawyertool)' : ' no Lawyertool'}.
              </p>
              <ul className="my-4 space-y-2">
                {escolhidas.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 rounded-xl bg-black/30 px-3 py-2 text-sm">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', CORES_SETOR[t.setor] ?? 'bg-zinc-400')} />
                    <span><span className="text-zinc-100">{t.cliente}</span> <span className="text-zinc-500">· {t.tipo}</span></span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmando(false)} disabled={enviando} className="rounded-xl px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5">
                  Voltar
                </button>
                <BotaoBrilho variante="sucesso" onClick={confirmar} desativado={enviando}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar e iniciar
                </BotaoBrilho>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, FlaskConical, Loader2, MapPin, PackageCheck, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { BotaoBrilho } from '@/components/ui/botao-brilho';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { ResultadoMaterialColetado, TarefaAtendimento } from '@/models/atendimento.model';

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

function LinhaTarefa({ t, marcada, aoMudar, hoje }: { t: TarefaAtendimento; marcada: boolean; aoMudar: () => void; hoje: string }) {
  const atrasada = t.situacao === 'pendente' && t.prazo < hoje;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      onClick={aoMudar}
      className={cn('flex cursor-pointer gap-3 px-4 py-3 transition-colors', marcada ? 'bg-emerald-500/[0.07]' : 'hover:bg-white/[0.03]')}
    >
      <div className="pt-0.5">
        <Caixa marcada={marcada} aoMudar={aoMudar} rotulo={`Selecionar ${t.cliente}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium text-zinc-100">{t.cliente}</p>
          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px]', t.prazo === hoje ? 'bg-violet-500/15 text-violet-200' : atrasada ? 'bg-rose-500/15 text-rose-200' : 'bg-white/5 text-zinc-400')}>
            {t.prazo === hoje ? 'Hoje' : diaCurto(t.prazo)}
          </span>
          {t.exemplo && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-300">exemplo</span>}
        </div>
        <p className="text-xs text-zinc-500">{t.tipo}</p>
        <p className="mt-1 text-sm text-zinc-300">{t.descricao}</p>
        {t.cidade && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" /> {t.cidade}
            {t.processo ? ` · ${t.processo}` : ''}
          </p>
        )}
      </div>
    </motion.li>
  );
}

export function SemanaAtendente() {
  const [atendenteId] = useState('teste');
  const { dados, erro, carregando, recarregar } = useConsulta(() => api.atendimento(atendenteId), null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoMaterialColetado[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [verIniciadas, setVerIniciadas] = useState(false);

  const tarefas = dados?.tarefas ?? [];
  const pendentes = tarefas.filter((t) => t.situacao === 'pendente');
  const iniciadas = tarefas.filter((t) => t.situacao === 'iniciada');
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

  const escolhidas = tarefas.filter((t) => selecionadas.has(t.id));
  const progresso = tarefas.length ? Math.round((iniciadas.length / tarefas.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-medium text-emerald-300">Atendimento externo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tarefas da semana</h1>
          {dados && (
            <p className="mt-1 text-zinc-400">
              {dados.atendente.nome} · {diaCurto(dados.semana.inicio)} a {diaCurto(dados.semana.fim)}
            </p>
          )}
        </div>
        <button onClick={recriar} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">
          <RotateCcw className="h-4 w-4" /> Recriar exemplos
        </button>
      </div>

      {dados && (!dados.gravaNoLawyertool || tarefas.some((t) => t.exemplo)) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>Modo de teste: atendente e tarefas são fictícios (com os tipos reais do Atendimento Externo). &quot;Material coletado&quot; inicia as tarefas só aqui — nada é alterado no Lawyertool.</span>
        </div>
      )}

      {dados && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-300">{iniciadas.length} de {tarefas.length} iniciadas</span>
            <span className="tabular-nums text-zinc-500">{progresso}%</span>
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
                  <Caixa marcada={marcadas === lista.length} parcial={marcadas > 0 && marcadas < lista.length} aoMudar={() => alternarSetor(lista)} rotulo={`Selecionar todas de ${setor}`} />
                  <span className={cn('h-2 w-2 rounded-full', CORES_SETOR[setor] ?? 'bg-zinc-400')} />
                  <h2 className="flex-1 font-medium text-zinc-100">{setor}</h2>
                  <span className="text-xs tabular-nums text-zinc-500">{marcadas ? `${marcadas}/` : ''}{lista.length}</span>
                </header>
                <ul className="divide-y divide-white/5">
                  <AnimatePresence initial={false}>
                    {lista.map((t) => <LinhaTarefa key={t.id} t={t} hoje={hoje} marcada={selecionadas.has(t.id)} aoMudar={() => alternar(t.id)} />)}
                  </AnimatePresence>
                </ul>
              </section>
            );
          })}
          {!pendentes.length && (
            <div className="grid h-32 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">Nenhuma tarefa pendente nesta semana.</div>
          )}

          {iniciadas.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-zinc-900/50">
              <button onClick={() => setVerIniciadas(!verIniciadas)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <PackageCheck className="h-4 w-4 text-emerald-400" />
                <span className="flex-1 text-sm text-zinc-300">Iniciadas ({iniciadas.length})</span>
                <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', verIniciadas && 'rotate-180')} />
              </button>
              {verIniciadas && (
                <ul className="divide-y divide-white/5 border-t border-white/5">
                  {iniciadas.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="min-w-0 flex-1 truncate text-zinc-300">{t.cliente} · <span className="text-zinc-500">{t.tipo}</span></span>
                      <span className="shrink-0 text-xs text-zinc-500">{t.iniciadaEm ? new Date(t.iniciadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {/* Barra fixa: aparece quando há tarefas selecionadas */}
      <AnimatePresence>
        {selecionadas.size > 0 && (
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
              <p className="mt-1 text-sm text-zinc-400">As {escolhidas.length} tarefas abaixo serão iniciadas.</p>
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

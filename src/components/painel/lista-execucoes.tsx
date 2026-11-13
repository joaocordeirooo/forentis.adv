'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, ChevronDown, FlaskConical, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api, type ExecucaoCompleta, type ExecucaoResumo } from '@/lib/api-client';
import { dataHora, ROTULO_DECISAO } from '@/lib/formato';
import { cn } from '@/lib/utils';

function Anel({ tratadas, total }: { tratadas: number; total: number }) {
  const fracao = total ? tratadas / total : 0;
  const raio = 18;
  const circ = 2 * Math.PI * raio;
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
      <circle cx="22" cy="22" r={raio} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <motion.circle cx="22" cy="22" r={raio} fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - fracao) }} transition={{ duration: 1, ease: 'easeOut' }} />
    </svg>
  );
}

function Detalhe({ id }: { id: string }) {
  const { dados, carregando } = useConsulta(() => api.execucao(id), null);
  if (carregando || !dados) return <Esqueleto className="h-32" />;
  return <Relatorio execucao={dados} />;
}

function Relatorio({ execucao }: { execucao: ExecucaoCompleta }) {
  return (
    <div className="space-y-2">
      {execucao.erro && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{execucao.erro}</p>}
      {execucao.resultados.map((r, i) => (
        <motion.div key={r.tarefaId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-white/5 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {r.tratada ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-amber-400" />}
            <span className="text-sm text-zinc-100">{r.clienteNome ?? 'Cliente'}</span>
            <span className="text-xs text-zinc-500">tarefa #{r.tarefaId} · processo {r.processoId ?? '—'}</span>
            <span className="ml-auto rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-300">{ROTULO_DECISAO[r.decisaoAnalise] ?? r.decisaoAnalise}</span>
          </div>
          {r.resumoAnalise && <p className="mt-2 text-xs leading-relaxed text-zinc-400">{r.resumoAnalise}</p>}
          {r.motivos.length > 0 && (
            <ul className="mt-2 space-y-1 pl-5 text-xs text-amber-200/90">{r.motivos.map((m, j) => <li key={j} className="list-disc">{m}</li>)}</ul>
          )}
          {r.observacoes.length > 0 && (
            <ul className="mt-2 space-y-1 pl-5 text-xs text-zinc-500">{r.observacoes.map((o, j) => <li key={j} className="list-disc">{o}</li>)}</ul>
          )}
          {r.solicitacoes.length > 0 && <p className="mt-2 text-xs text-violet-300">{r.solicitacoes.length} solicitação(ões) preparada(s)</p>}
        </motion.div>
      ))}
    </div>
  );
}

function Linha({ e }: { e: ExecucaoResumo }) {
  const [aberta, setAberta] = useState(false);
  const Icone = e.status === 'em_andamento' ? Loader2 : e.status === 'falhou' ? XCircle : CheckCircle2;
  return (
    <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-zinc-900/80">
      <button onClick={() => setAberta(!aberta)} className="flex w-full items-center gap-4 p-4 text-left">
        <Anel tratadas={e.tarefasProcessadas - e.naoTratadas} total={e.tarefasProcessadas} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Icone className={cn('h-4 w-4', e.status === 'em_andamento' && 'animate-spin text-violet-300', e.status === 'falhou' && 'text-rose-400', e.status === 'concluida' && 'text-emerald-400')} />
            {dataHora(e.iniciadaEm)}
            {e.modoTeste && <FlaskConical className="h-3.5 w-3.5 text-amber-300" aria-label="Modo teste" />}
          </p>
          <p className="text-xs text-zinc-500">
            {e.tarefasProcessadas} processada(s) de {e.tarefasEncontradas} encontrada(s){e.filtroTarefaId ? ` · só a tarefa #${e.filtroTarefaId}` : ''}{e.tarefaIds?.length ? ` · ${e.tarefaIds.length} escolhida(s)` : ''}{e.solicitadoPor ? ` · pedida por ${e.solicitadoPor}` : e.origem === 'agenda' ? ' · automática (agenda)' : ''} · {e.naoTratadas} não tratada(s)
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition', aberta && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4"><Detalhe id={e.id} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function ListaExecucoes() {
  const { dados, erro, carregando } = useConsulta(api.execucoes, 15_000);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Execuções</h1>
        <p className="mt-1 text-zinc-400">Cada rodada da automação, com as tarefas não tratadas e o motivo de cada uma.</p>
      </div>
      <AvisoErro erro={erro} />
      {carregando ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-20" />)}</div>
      ) : (
        <ul className="space-y-3">
          {(dados ?? []).map((e) => <Linha key={e.id} e={e} />)}
          {!dados?.length && <li className="grid h-32 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">Nenhuma execução ainda.</li>}
        </ul>
      )}
    </div>
  );
}

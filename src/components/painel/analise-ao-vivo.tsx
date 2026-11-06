'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { BordaLuminosa } from '@/components/ui/borda-luminosa';
import { BotaoBrilho } from '@/components/ui/botao-brilho';
import { api, type ExecucaoCompleta } from '@/lib/api-client';
import { relativo, ROTULO_DECISAO } from '@/lib/formato';
import { cn } from '@/lib/utils';

// Inicia uma análise e mostra as tarefas aparecendo conforme são processadas.
export function AnaliseAoVivo({ execucao, aoIniciar }: { execucao: ExecucaoCompleta | null; aoIniciar: () => void }) {
  const [tarefaId, setTarefaId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [forcar, setForcar] = useState(false);
  const rodando = execucao?.status === 'em_andamento';
  const total = execucao ? Math.max(execucao.tarefasProcessadas, execucao.modoTeste ? Math.min(execucao.tarefasEncontradas, 3) : execucao.tarefasEncontradas) : 0;
  const progresso = execucao && total ? Math.round((execucao.tarefasProcessadas / total) * 100) : 0;

  async function iniciar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.iniciarAnalise(tarefaId ? Number(tarefaId) : undefined, forcar);
      setTarefaId('');
      aoIniciar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative rounded-2xl border border-white/10 bg-zinc-900/80 p-5">
      {rodando && <BordaLuminosa cor="#a78bfa" />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Análise</h2>
          <p className="text-sm text-zinc-400">
            {rodando ? 'Rodando agora — as tarefas aparecem abaixo.' : execucao ? `Última: ${relativo(execucao.iniciadaEm)}` : 'Nenhuma execução ainda.'}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input
            inputMode="numeric"
            placeholder="ID da tarefa (opcional)"
            value={tarefaId}
            onChange={(e) => setTarefaId(e.target.value.replace(/\D/g, ''))}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500 sm:w-48"
          />
          <BotaoBrilho onClick={iniciar} desativado={enviando || rodando}>
            {enviando || rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Analisar
          </BotaoBrilho>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} className="accent-violet-500" />
        Reanalisar também as tarefas sem novidade (mais demorado e mais caro)
      </label>
      {erro && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{erro}</p>}

      {execucao && (
        <>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${execucao.status === 'em_andamento' ? Math.max(progresso, 6) : 100}%` }}
              transition={{ type: 'spring', stiffness: 60, damping: 20 }}
            />
          </div>
          <p className="mb-3 text-xs text-zinc-500">
            {execucao.tarefasProcessadas} de {execucao.tarefasEncontradas} tarefas ·{' '}
            {execucao.resultados.filter((r) => r.decisaoAnalise === 'sem_mudanca').length} sem novidade ·{' '}
            {execucao.resultados.filter((r) => r.decisaoAnalise === 'triagem_sem_pedido').length} descartadas na triagem
          </p>
          {execucao.erro && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{execucao.erro}</p>}
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {execucao.resultados.filter((r) => r.decisaoAnalise !== 'sem_mudanca' && r.decisaoAnalise !== 'triagem_sem_pedido').slice(-30).map((r) => (
                <motion.li
                  key={r.tarefaId}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-xl border border-white/5 bg-black/20 p-3"
                >
                  <div className="flex items-center gap-2">
                    {r.tratada ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />}
                    <span className="truncate text-sm text-zinc-200">{r.clienteNome ?? 'Cliente'}</span>
                    <span className="text-xs text-zinc-500">#{r.tarefaId}</span>
                    <span className={cn('ml-auto shrink-0 rounded-md px-2 py-0.5 text-xs', r.tratada ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300')}>
                      {ROTULO_DECISAO[r.decisaoAnalise] ?? r.decisaoAnalise}
                    </span>
                  </div>
                  {r.motivos.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-6 text-xs text-zinc-400">
                      {r.motivos.map((m, i) => (
                        <li key={i} className="list-disc">{m}</li>
                      ))}
                    </ul>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
            {rodando && (
              <li className="flex items-center gap-2 px-3 py-2 text-sm text-violet-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Lendo a próxima tarefa…
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

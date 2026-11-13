'use client';

import { CalendarClock, ExternalLink, Eye, Loader2, Play, RefreshCw, Search, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { relativo } from '@/lib/formato';
import { linkTarefaLawyertool } from '@/lib/lawyertool-link';
import { cn } from '@/lib/utils';
import type { EstadoTarefa } from '@/models/tarefa.model';
import { normalizar } from '@/utils/texto.util';
import { JanelaTarefaLawyertool } from './janela-tarefa-lawyertool';

// Situação da tarefa na automação, em uma etiqueta.
function SituacaoAutomacao({ estado }: { estado: EstadoTarefa | null }) {
  if (!estado) return <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400">Ainda não analisada</span>;
  if (estado.decisao === 'triagem_sem_pedido') {
    return <span className="rounded-md bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-400" title={estado.triagem?.motivo}>Sem pedido externo</span>;
  }
  if (estado.solicitacoes.length) {
    return <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">{estado.solicitacoes.length} solicitação(ões) preparada(s)</span>;
  }
  if (!estado.tratada) {
    return <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300" title={estado.motivos.join('\n')}>Precisa de atenção</span>;
  }
  return <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">Nada a pedir</span>;
}

export function ListaTarefas() {
  const [tarefaAberta, setTarefaAberta] = useState<number | null>(null);
  const roteador = useRouter();
  const [atualizar, setAtualizar] = useState(0);
  const { dados, erro, carregando } = useConsulta(() => api.tarefas(atualizar > 0), null, atualizar);
  const [tipo, setTipo] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(50);
  const [iniciando, setIniciando] = useState<number | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return (dados?.tarefas ?? [])
      .filter((t) => tipo === null || t.tipoTarefa?.id === tipo)
      .filter((t) => !termo || normalizar(`${t.emitente?.nome} ${t.id} ${t.processo?.numeroProcesso} ${t.usuarioResponsavel?.nome}`).includes(termo));
  }, [dados, tipo, busca]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tarefas monitoradas</h1>
          <p className="mt-1 text-zinc-400">
            Pendentes do setor Revisão que podem envolver documentos externos
            {dados ? ` · ${dados.total} tarefas · atualizado ${relativo(dados.atualizadoEm)}` : ''}.
          </p>
        </div>
        <button onClick={() => setAtualizar((n) => n + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">
          <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} /> Atualizar do Lawyertool
        </button>
      </div>

      {dados && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTipo(null)} className={cn('rounded-xl px-3 py-1.5 text-sm ring-1 ring-inset', tipo === null ? 'bg-white/10 text-white ring-white/20' : 'text-zinc-400 ring-white/10 hover:text-zinc-200')}>
            Todos <span className="ml-1 tabular-nums text-zinc-500">{dados.total}</span>
          </button>
          {dados.porTipo.filter((t) => t.quantidade > 0).map((t) => (
            <button
              key={t.tipoTarefaId}
              onClick={() => setTipo(t.tipoTarefaId)}
              className={cn('rounded-xl px-3 py-1.5 text-left text-sm ring-1 ring-inset', tipo === t.tipoTarefaId ? 'bg-white/10 text-white ring-white/20' : 'text-zinc-400 ring-white/10 hover:text-zinc-200')}
              title={t.triagem ? 'Passa por triagem da IA antes da análise completa' : undefined}
            >
              {t.descricao.replace(/ - Material [Ii]nterno$/, '')}
              {t.triagem && <span className="ml-1 text-xs text-sky-300">· triagem</span>}
              <span className="ml-1 tabular-nums text-zinc-500">{t.quantidade}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative sm:w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, tarefa, processo ou responsável" className="w-full rounded-xl border border-white/10 bg-zinc-900/80 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500" />
      </div>

      <AvisoErro erro={erro ?? (falha ? new Error(falha) : null)} />

      {carregando && !dados ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Esqueleto key={i} className="h-16" />)}</div>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80">
          {visiveis.slice(0, limite).map((t) => {
            // Data calculada só quando há tarefas (o Next não aceita Date na pré-renderização).
            const atrasada = t.dataFinalEsperada && t.dataFinalEsperada < new Date().toISOString().slice(0, 10);
            return (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{t.emitente?.nome ?? 'Cliente'}</p>
                  <p className="truncate text-xs text-zinc-500">
                    #{t.id} · {t.tipoTarefa?.descricao} · processo {t.processo?.numeroProcesso || t.processo?.id || '—'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5', atrasada ? 'bg-rose-500/10 text-rose-300' : 'bg-white/5 text-zinc-400')}>
                    <CalendarClock className="h-3 w-3" />
                    {t.dataFinalEsperada ? new Date(`${t.dataFinalEsperada}T12:00`).toLocaleDateString('pt-BR') : 'sem prazo'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-zinc-400">
                    <UserRound className="h-3 w-3" /> {t.usuarioResponsavel?.nome ?? '—'}
                  </span>
                  <SituacaoAutomacao estado={t.estado} />
                </div>
                <button
                  onClick={() => analisar(t.id)}
                  disabled={iniciando !== null}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5 text-xs text-sky-200 ring-1 ring-white/10 transition-colors hover:bg-sky-500/15 disabled:opacity-50 sm:self-auto"
                >
                  {iniciando === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Analisar
                </button>
                <span className="flex shrink-0 items-center gap-1 self-start sm:self-auto">
                  <button onClick={() => setTarefaAberta(t.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" title="Ver a tarefa na íntegra">
                    <Eye className="h-4 w-4" />
                  </button>
                  <a href={linkTarefaLawyertool(t.id)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-zinc-400 hover:bg-violet-500/15 hover:text-violet-200" title="Abrir no Lawyertool">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </span>
              </li>
            );
          })}
          {!visiveis.length && <li className="px-4 py-10 text-center text-sm text-zinc-500">Nenhuma tarefa neste filtro.</li>}
        </ul>
      )}
      {visiveis.length > limite && (
        <button onClick={() => setLimite(limite + 50)} className="w-full rounded-2xl border border-white/10 py-3 text-sm text-zinc-300 hover:bg-white/5">
          Mostrar mais ({visiveis.length - limite} restantes)
        </button>
      )}
      <JanelaTarefaLawyertool tarefaId={tarefaAberta} aoFechar={() => setTarefaAberta(null)} />
    </div>
  );
}

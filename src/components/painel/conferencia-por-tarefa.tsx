'use client';

import { motion } from 'motion/react';
import { Paperclip, ShieldAlert, User } from 'lucide-react';
import { CartaoSpotlight } from '@/components/ui/cartao-spotlight';
import { Etiqueta, SeloStatus } from '@/components/ui/selo-status';
import { relativo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Solicitacao } from '@/models/solicitacao.model';
import { STATUS_ABERTOS_PAINEL, tituloSolicitacao, VISUAL_TIPO } from './tipo-solicitacao';

const ORDEM_TIPO = { cliente: 0, empresa: 1, indefinida: 2 } as const;
const ARQUIVADAS = ['descartada', 'substituida'];

export interface GrupoTarefa {
  tarefaId: number;
  itens: Solicitacao[];
  abertas: number;
  maisRecente: string;
}

// Junta as solicitações por tarefa: o funcionário vê, de uma vez, o pedido ao cliente e o de cada empresa.
// Só entram tarefas com algo aberto; dentro delas aparecem também os pedidos já enviados.
export function agruparPorTarefa(lista: Solicitacao[]): GrupoTarefa[] {
  const grupos = new Map<number, Solicitacao[]>();
  for (const s of lista) {
    if (ARQUIVADAS.includes(s.status)) continue;
    grupos.set(s.tarefaId, [...(grupos.get(s.tarefaId) ?? []), s]);
  }
  return [...grupos.entries()]
    .map(([tarefaId, itens]) => ({
      tarefaId,
      itens: itens.sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || (a.empresa ?? '').localeCompare(b.empresa ?? '', 'pt-BR')),
      abertas: itens.filter((s) => STATUS_ABERTOS_PAINEL.includes(s.status)).length,
      maisRecente: itens.reduce((m, s) => (s.criadaEm > m ? s.criadaEm : m), ''),
    }))
    .filter((g) => g.abertas > 0)
    .sort((a, b) => b.maisRecente.localeCompare(a.maisRecente));
}

function Pedido({ s, aoAbrir }: { s: Solicitacao; aoAbrir: () => void }) {
  const visual = VISUAL_TIPO[s.tipo];
  const Icone = visual.icone;
  const aberta = STATUS_ABERTOS_PAINEL.includes(s.status);
  const aClassificar = s.tipo === 'indefinida' ? s.pendencias.filter((p) => !p.classificacao).length : 0;
  return (
    <button onClick={aoAbrir} className={cn('group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', aberta ? 'border-white/10 bg-black/30 hover:border-white/25' : 'border-white/5 bg-black/10 opacity-60 hover:opacity-90')}>
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', visual.classe)}>
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-zinc-500">{visual.rotulo}</span>
        <span className="block truncate text-sm font-medium text-zinc-100">{s.tipo === 'cliente' ? 'Mensagem ao cliente' : tituloSolicitacao(s)}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-400">
          {s.tipo === 'cliente' ? s.texto : s.pendencias.map((p) => p.documento).join('; ')}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <SeloStatus status={s.status} />
          {aClassificar > 0 && <span className="text-xs text-amber-300">{aClassificar} a classificar</span>}
          {s.bloqueios.length > 0 && aberta && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-300"><ShieldAlert className="h-3.5 w-3.5" /> {s.bloqueios.length}</span>
          )}
          {s.anexos.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-zinc-400"><Paperclip className="h-3.5 w-3.5" /> {s.anexos.length}</span>}
        </span>
      </span>
    </button>
  );
}

export function ConferenciaPorTarefa({ grupos, aoAbrir }: { grupos: GrupoTarefa[]; aoAbrir: (id: string) => void }) {
  if (!grupos.length) {
    return <div className="grid h-32 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">Nada aguardando conferência neste setor.</div>;
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {grupos.map((g, i) => {
        const base = g.itens[0];
        const feitos = g.itens.length - g.abertas;
        return (
          <motion.div key={g.tarefaId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
            <CartaoSpotlight className="h-full p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-semibold text-white"><User className="h-4 w-4 shrink-0 text-zinc-500" /> {base.clienteNome ?? 'Cliente não identificado'}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{base.origem?.tipoTarefa?.descricao ?? base.tarefaTitulo ?? '—'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Etiqueta>Tarefa #{g.tarefaId}</Etiqueta>
                    <Etiqueta>Processo {base.processoId}</Etiqueta>
                    {base.responsavel && <Etiqueta>{base.responsavel}</Etiqueta>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold tabular-nums text-white">{feitos}/{g.itens.length}</p>
                  <p className="text-[11px] text-zinc-500">concluídos · {relativo(g.maisRecente)}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.itens.map((s) => <Pedido key={s.id} s={s} aoAbrir={() => aoAbrir(s.id)} />)}
              </div>
            </CartaoSpotlight>
          </motion.div>
        );
      })}
    </div>
  );
}

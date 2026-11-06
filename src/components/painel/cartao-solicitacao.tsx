'use client';

import { motion } from 'motion/react';
import { Building2, MessageCircle, Paperclip, ShieldAlert } from 'lucide-react';
import { CartaoSpotlight } from '@/components/ui/cartao-spotlight';
import { SeloStatus } from '@/components/ui/selo-status';
import { relativo } from '@/lib/formato';
import type { Solicitacao } from '@/models/solicitacao.model';
import { cn } from '@/lib/utils';

export function CartaoSolicitacao({ solicitacao: s, aoAbrir, indice = 0 }: { solicitacao: Solicitacao; aoAbrir: () => void; indice?: number }) {
  const cliente = s.tipo === 'cliente';
  const Icone = cliente ? MessageCircle : Building2;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(indice * 0.04, 0.4) }}
    >
      <CartaoSpotlight onClick={aoAbrir} cor={cliente ? 'rgba(52,211,153,0.15)' : 'rgba(129,140,248,0.18)'} className="h-full p-4 transition hover:border-white/20">
        <div className="mb-3 flex items-start gap-3">
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cliente ? 'bg-emerald-500/15 text-emerald-300' : 'bg-indigo-500/15 text-indigo-300')}>
            <Icone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-zinc-100">{cliente ? s.clienteNome : s.empresa}</p>
            <p className="truncate text-xs text-zinc-500">
              {cliente ? 'Cliente' : `Empresa · ${s.clienteNome ?? ''}`} · tarefa #{s.tarefaId}
            </p>
          </div>
        </div>
        <p className="mb-3 line-clamp-3 text-sm text-zinc-300">{cliente ? s.texto : s.pendencias.map((p) => p.documento).join('; ')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <SeloStatus status={s.status} />
          {s.bloqueios.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" /> {s.bloqueios.length}
            </span>
          )}
          {s.anexos.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
              <Paperclip className="h-3.5 w-3.5" /> {s.anexos.length}
            </span>
          )}
          <span className="ml-auto text-xs text-zinc-500">{relativo(s.criadaEm)}</span>
        </div>
      </CartaoSpotlight>
    </motion.div>
  );
}

'use client';

import { motion } from 'motion/react';
import { Paperclip, ShieldAlert } from 'lucide-react';
import { CartaoSpotlight } from '@/components/ui/cartao-spotlight';
import { SeloStatus } from '@/components/ui/selo-status';
import { relativo } from '@/lib/formato';
import type { Solicitacao } from '@/models/solicitacao.model';
import { cn } from '@/lib/utils';
import { tituloSolicitacao, VISUAL_TIPO } from './tipo-solicitacao';

export function CartaoSolicitacao({ solicitacao: s, aoAbrir, indice = 0 }: { solicitacao: Solicitacao; aoAbrir: () => void; indice?: number }) {
  const cliente = s.tipo === 'cliente';
  const visual = VISUAL_TIPO[s.tipo];
  const Icone = visual.icone;
  const abertasIndefinidas = s.tipo === 'indefinida' ? s.pendencias.filter((p) => !p.classificacao).length : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(indice * 0.04, 0.4) }}
    >
      <CartaoSpotlight onClick={aoAbrir} cor={visual.spot} className="h-full p-4 transition hover:border-white/20">
        <div className="mb-3 flex items-start gap-3">
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', visual.classe)}>
            <Icone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-zinc-100">{tituloSolicitacao(s)}</p>
            <p className="truncate text-xs text-zinc-500">
              {cliente ? 'Cliente' : `${visual.rotulo} · ${s.clienteNome ?? ''}`} · tarefa #{s.tarefaId}{s.origem?.setor ? ` · ${s.origem.setor.descricao}` : ''}
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
          {abertasIndefinidas > 0 && <span className="text-xs text-amber-300">{abertasIndefinidas} a classificar</span>}
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

'use client';

import { CalendarDays, Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Campos dos painéis de filtro (Tarefas e Solicitações), no mesmo visual.

export const estiloCampo = 'w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50';

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-zinc-400">{rotulo}</span>
      {children}
    </label>
  );
}

export function IntervaloDatas({ rotulo, de, ate, aoMudar }: { rotulo: string; de: string; ate: string; aoMudar: (de: string, ate: string) => void }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 flex items-center gap-1 text-xs text-zinc-400">
        <CalendarDays className="h-3 w-3" /> {rotulo}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" aria-label={`${rotulo} — início`} value={de} max={ate || undefined} onChange={(e) => aoMudar(e.target.value, ate)} className={cn(estiloCampo, 'scheme-dark')} />
        <input type="date" aria-label={`${rotulo} — fim`} value={ate} min={de || undefined} onChange={(e) => aoMudar(de, e.target.value)} className={cn(estiloCampo, 'scheme-dark')} />
      </div>
    </div>
  );
}

// Lista suspensa com várias opções marcáveis (vazio = todas).
export function SeletorMultiplo<T extends string>({
  valor,
  aoMudar,
  opcoes,
  vazio = 'Todas',
}: {
  valor: T[];
  aoMudar: (v: T[]) => void;
  opcoes: { valor: T; rotulo: string; contagem?: number }[];
  vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  const rotuloDe = (v: T) => opcoes.find((o) => o.valor === v)?.rotulo ?? v;
  const texto = !valor.length ? vazio : valor.length === 1 ? rotuloDe(valor[0]) : `${valor.length} itens selecionados`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto((a) => !a)} className={cn(estiloCampo, 'flex items-center justify-between gap-2 text-left')} aria-expanded={aberto}>
        <span className="truncate">{texto}</span>
        <span className="flex shrink-0 items-center gap-1 text-zinc-500">
          {valor.length > 0 && (
            <X
              className="h-4 w-4 hover:text-zinc-200"
              onClick={(e) => {
                e.stopPropagation();
                aoMudar([]);
              }}
            />
          )}
          <ChevronDown className={cn('h-4 w-4 transition-transform', aberto && 'rotate-180')} />
        </span>
      </button>
      {aberto && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl">
          {opcoes.map((o) => {
            const marcado = valor.includes(o.valor);
            return (
              <li key={o.valor}>
                <button
                  type="button"
                  onClick={() => aoMudar(marcado ? valor.filter((v) => v !== o.valor) : [...valor, o.valor])}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
                >
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcado ? 'border-violet-500 bg-violet-500' : 'border-white/20')}>
                    {marcado && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="flex-1 truncate">{o.rotulo}</span>
                  {o.contagem !== undefined && <span className="text-xs tabular-nums text-zinc-500">{o.contagem}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

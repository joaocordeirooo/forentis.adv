'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Paginação dos painéis (Tarefas e Solicitações): tamanho da página, faixa exibida e números.

function numerosPagina(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const meio = [atual - 1, atual, atual + 1].filter((n) => n > 1 && n < total);
  const lista: (number | '…')[] = [1];
  if (meio[0] > 2) lista.push('…');
  lista.push(...meio);
  if (meio[meio.length - 1] < total - 1) lista.push('…');
  lista.push(total);
  return lista;
}

export function Paginacao({
  tamanhos,
  pagina,
  totalPaginas,
  porPagina,
  totalItens,
  aoIr,
  aoMudarPorPagina,
}: {
  tamanhos: readonly number[];
  pagina: number;
  totalPaginas: number;
  porPagina: number;
  totalItens: number;
  aoIr: (n: number) => void;
  aoMudarPorPagina: (n: number) => void;
}) {
  const de = totalItens ? (pagina - 1) * porPagina + 1 : 0;
  const ate = Math.min(pagina * porPagina, totalItens);
  const botao = 'grid h-8 min-w-8 place-items-center rounded-lg border border-white/10 px-2 text-sm tabular-nums hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          Mostrar
          <select
            value={porPagina}
            onChange={(e) => aoMudarPorPagina(Number(e.target.value))}
            className="h-8 rounded-lg border border-white/10 bg-zinc-900/80 px-2 text-sm text-zinc-100 outline-none focus:border-violet-500"
          >
            {tamanhos.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          por página
        </label>
        <span className="tabular-nums text-zinc-500">
          {de.toLocaleString('pt-BR')}–{ate.toLocaleString('pt-BR')} de {totalItens.toLocaleString('pt-BR')}
        </span>
      </div>
      {totalPaginas > 1 && (
        <nav className="flex items-center gap-1" aria-label="Paginação">
          <button onClick={() => aoIr(1)} disabled={pagina <= 1} className={botao} aria-label="Primeira página"><ChevronsLeft className="h-4 w-4" /></button>
          <button onClick={() => aoIr(pagina - 1)} disabled={pagina <= 1} className={botao} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
          {numerosPagina(pagina, totalPaginas).map((n, i) =>
            n === '…' ? (
              <span key={`r${i}`} className="px-1 text-zinc-600">…</span>
            ) : (
              <button
                key={n}
                onClick={() => aoIr(n)}
                aria-current={n === pagina ? 'page' : undefined}
                className={cn(botao, n === pagina && 'border-violet-500/60 bg-violet-500/15 text-white')}
              >
                {n}
              </button>
            ),
          )}
          <button onClick={() => aoIr(pagina + 1)} disabled={pagina >= totalPaginas} className={botao} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => aoIr(totalPaginas)} disabled={pagina >= totalPaginas} className={botao} aria-label="Última página"><ChevronsRight className="h-4 w-4" /></button>
        </nav>
      )}
    </div>
  );
}

'use client';

import { ArrowDown, ArrowUp, Check, Columns3, GripVertical, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Personalização das colunas de uma tabela: quais aparecem e em que ordem (salvo no navegador).

export interface ConfigColunas {
  ordem: string[]; // ids na ordem escolhida
  ocultas: string[]; // ids escondidos
}

// Junta a configuração salva com as colunas atuais (colunas novas entram no fim, removidas somem).
export function aplicarConfig<T extends { id: string }>(colunas: T[], config: ConfigColunas | null): T[] {
  if (!config) return colunas;
  const porId = new Map(colunas.map((c) => [c.id, c]));
  const ordenadas = [...config.ordem.filter((id) => porId.has(id)), ...colunas.map((c) => c.id).filter((id) => !config.ordem.includes(id))];
  return ordenadas.filter((id) => !config.ocultas.includes(id)).map((id) => porId.get(id)!);
}

export function lerConfigColunas(chave: string): ConfigColunas | null {
  try {
    const bruto = localStorage.getItem(chave);
    const dados = bruto ? JSON.parse(bruto) : null;
    return dados && Array.isArray(dados.ordem) && Array.isArray(dados.ocultas) ? dados : null;
  } catch {
    return null;
  }
}

export function salvarConfigColunas(chave: string, config: ConfigColunas | null) {
  try {
    if (config) localStorage.setItem(chave, JSON.stringify(config));
    else localStorage.removeItem(chave);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

export function SeletorColunas({
  colunas,
  config,
  aoMudar,
}: {
  colunas: { id: string; titulo: string }[];
  config: ConfigColunas | null;
  aoMudar: (config: ConfigColunas | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
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

  const porId = new Map(colunas.map((c) => [c.id, c]));
  const ordem = config
    ? [...config.ordem.filter((id) => porId.has(id)), ...colunas.map((c) => c.id).filter((id) => !config.ordem.includes(id))]
    : colunas.map((c) => c.id);
  const ocultas = new Set(config?.ocultas ?? []);
  const visiveis = ordem.filter((id) => !ocultas.has(id)).length;

  const mudar = (novaOrdem: string[], novasOcultas: Set<string>) => aoMudar({ ordem: novaOrdem, ocultas: [...novasOcultas] });

  function alternar(id: string) {
    const novas = new Set(ocultas);
    if (novas.has(id)) novas.delete(id);
    else if (visiveis > 1) novas.add(id); // sempre fica ao menos uma coluna
    mudar(ordem, novas);
  }

  function mover(id: string, destino: number) {
    const atual = ordem.indexOf(id);
    if (destino < 0 || destino >= ordem.length || atual === destino) return;
    const nova = [...ordem];
    nova.splice(atual, 1);
    nova.splice(destino, 0, id);
    mudar(nova, ocultas);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors', config ? 'border-violet-500/50 text-violet-200' : 'border-white/10 text-zinc-300 hover:bg-white/5')}
      >
        <Columns3 className="h-3.5 w-3.5" /> Colunas{config ? ` (${visiveis}/${colunas.length})` : ''}
      </button>
      {aberto && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-xs text-zinc-400">Marque e arraste para ordenar</p>
            {config && (
              <button type="button" onClick={() => aoMudar(null)} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
                <RotateCcw className="h-3 w-3" /> Padrão
              </button>
            )}
          </div>
          <ul className="max-h-80 space-y-0.5 overflow-y-auto">
            {ordem.map((id, i) => {
              const coluna = porId.get(id)!;
              const marcada = !ocultas.has(id);
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={() => setArrastando(id)}
                  onDragEnd={() => setArrastando(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => arrastando && mover(arrastando, i)}
                  className={cn('group flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm hover:bg-white/5', arrastando === id && 'opacity-40')}
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-zinc-600" />
                  <button type="button" onClick={() => alternar(id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcada ? 'border-violet-500 bg-violet-500' : 'border-white/20')}>
                      {marcada && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className={cn('truncate', marcada ? 'text-zinc-100' : 'text-zinc-500')}>{coluna.titulo === '#' ? 'Código (#)' : coluna.titulo}</span>
                  </button>
                  <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => mover(id, i - 1)} disabled={i === 0} className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => mover(id, i + 1)} disabled={i === ordem.length - 1} className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30" aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

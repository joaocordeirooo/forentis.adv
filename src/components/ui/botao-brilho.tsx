'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Botão com reflexo passando (estilo "shimmer button").
export function BotaoBrilho({
  children,
  onClick,
  desativado,
  className,
  variante = 'primario',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  desativado?: boolean;
  className?: string;
  variante?: 'primario' | 'sucesso' | 'perigo' | 'neutro';
  type?: 'button' | 'submit';
}) {
  const cores = {
    primario: 'from-violet-600 to-indigo-600 shadow-violet-600/30',
    sucesso: 'from-emerald-600 to-teal-600 shadow-emerald-600/30',
    perigo: 'from-rose-600 to-red-600 shadow-rose-600/30',
    neutro: 'from-zinc-700 to-zinc-800 shadow-black/30',
  }[variante];

  return (
    <motion.button
      type={type}
      whileHover={desativado ? undefined : { scale: 1.02 }}
      whileTap={desativado ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={desativado}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
        cores,
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.25)_50%,transparent_75%)] bg-[length:200%_100%]"
      />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

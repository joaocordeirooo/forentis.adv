'use client';

import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Cartão de vidro com um brilho que segue o mouse (estilo "spotlight card").
export function CartaoSpotlight({
  children,
  className,
  cor = 'rgba(139, 92, 246, 0.18)',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  cor?: string;
  onClick?: () => void;
}) {
  const x = useMotionValue(-300);
  const y = useMotionValue(-300);
  const fundo = useMotionTemplate`radial-gradient(320px circle at ${x}px ${y}px, ${cor}, transparent 70%)`;

  return (
    <div
      onClick={onClick}
      onMouseMove={(e) => {
        const caixa = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - caixa.left);
        y.set(e.clientY - caixa.top);
      }}
      onMouseLeave={() => {
        x.set(-300);
        y.set(-300);
      }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: fundo }} />
      <div className="relative">{children}</div>
    </div>
  );
}

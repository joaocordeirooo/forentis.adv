'use client';

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

// Painel que desliza da direita (no celular ocupa a tela toda).
export function PainelLateral({ aberto, aoFechar, titulo, children }: { aberto: boolean; aoFechar: () => void; titulo: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  return (
    <AnimatePresence>
      {aberto && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={aoFechar}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-white/10 bg-zinc-950 shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">{titulo}</div>
              <button onClick={aoFechar} className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

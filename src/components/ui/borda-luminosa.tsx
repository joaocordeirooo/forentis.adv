import { cn } from '@/lib/utils';

// Contorno colorido que "respira" (só opacidade: leve para o navegador).
export function BordaLuminosa({ cor = '#a78bfa', className }: { cor?: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute -inset-px rounded-[inherit] animate-pulse-soft', className)}
      style={{ boxShadow: `0 0 0 1px ${cor}, 0 0 18px -4px ${cor}` }}
    />
  );
}

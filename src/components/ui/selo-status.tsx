import { COR_STATUS, ROTULO_STATUS } from '@/lib/formato';
import type { StatusSolicitacao } from '@/models/solicitacao.model';
import { cn } from '@/lib/utils';

export function SeloStatus({ status, className }: { status: StatusSolicitacao; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', COR_STATUS[status], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', status === 'aguardando_conferencia' && 'animate-pulse')} />
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function Etiqueta({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-300 ring-1 ring-inset ring-white/10', className)}>
      {children}
    </span>
  );
}

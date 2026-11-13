import { ExternalLink } from 'lucide-react';
import { linkTarefaLawyertool } from '@/lib/lawyertool-link';
import { cn } from '@/lib/utils';

// Abre a tarefa no Lawyertool numa aba nova.
export function LinkTarefaLawyertool({ tarefaId, texto, className }: { tarefaId: number; texto?: string; className?: string }) {
  return (
    <a
      href={linkTarefaLawyertool(tarefaId)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn('inline-flex items-center gap-1 text-violet-300 hover:text-violet-200', className)}
      title={`Abrir a tarefa #${tarefaId} no Lawyertool`}
    >
      {texto ?? `Abrir tarefa #${tarefaId} no Lawyertool`} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

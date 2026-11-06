import { AlertTriangle } from 'lucide-react';

export function AvisoErro({ erro }: { erro: Error | null }) {
  if (!erro) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{erro.message}</span>
    </div>
  );
}

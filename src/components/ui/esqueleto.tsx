import { cn } from '@/lib/utils';

export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-xl bg-[linear-gradient(110deg,rgba(255,255,255,0.03)_25%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.03)_75%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

'use client';

import { motion } from 'motion/react';
import { Brain, Building2, CheckCircle2, ClipboardCheck, Database, MessageCircle, type LucideIcon } from 'lucide-react';
import { Contador } from '@/components/ui/contador';
import { BordaLuminosa } from '@/components/ui/borda-luminosa';
import { cn } from '@/lib/utils';

export interface NumerosFluxo {
  tarefas: number | null;
  analisadas: number;
  cliente: number;
  empresa: number;
  conferencia: number;
  enviadas: number;
  analisando: boolean;
}

interface Etapa {
  titulo: string;
  legenda: string;
  valor: number | null;
  icone: LucideIcon;
  cor: string; // tailwind (texto/fundo)
  hex: string;
  ativo?: boolean;
}

function No({ etapa, indice }: { etapa: Etapa; indice: number }) {
  const Icone = etapa.icone;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: indice * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
      className="relative w-full rounded-2xl border border-white/10 bg-zinc-900/90 p-4"
    >
      {etapa.ativo && <BordaLuminosa cor={etapa.hex} />}
      <div className="flex items-center gap-3">
        <span className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-xl', etapa.cor)}>
          <Icone className="relative h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{etapa.titulo}</p>
          <p className="text-xs leading-snug text-zinc-500">{etapa.legenda}</p>
        </div>
        <div className="ml-auto text-2xl font-semibold tabular-nums text-white">
          {etapa.valor === null ? <span className="text-zinc-600">—</span> : <Contador valor={etapa.valor} />}
        </div>
      </div>
    </motion.div>
  );
}

// Linha de ligação com um ponto de luz correndo (estilo "animated beam").
function Feixe({ hex, vertical, atraso = 0 }: { hex: string; vertical?: boolean; atraso?: number }) {
  return (
    <div className={cn('relative flex items-center justify-center', vertical ? 'h-8 w-full' : 'w-8 shrink-0 self-stretch')}>
      <div className={cn('relative overflow-hidden bg-white/10', vertical ? 'h-full w-[3px]' : 'h-[3px] w-full')}>
        <span
          className={cn('absolute rounded-full will-change-transform', vertical ? 'inset-x-0 top-0 h-1/4 animate-feixe-v' : 'inset-y-0 left-0 w-1/4 animate-feixe-h')}
          style={{ background: `linear-gradient(${vertical ? '180deg' : '90deg'}, transparent, ${hex}, transparent)`, animationDelay: `${atraso}s` }}
        />
      </div>
    </div>
  );
}

// Visualização do caminho de uma tarefa: Lawyertool → IA → cliente/empresa → conferência → envio.
export function FluxoAnimado({ numeros }: { numeros: NumerosFluxo }) {
  const etapas: Record<string, Etapa> = {
    lawyertool: { titulo: 'Lawyertool', legenda: 'Tarefas pendentes', valor: numeros.tarefas, icone: Database, cor: 'bg-sky-500/15 text-sky-300', hex: '#38bdf8' },
    ia: { titulo: 'Análise da IA', legenda: numeros.analisando ? 'Analisando agora…' : 'Na última execução', valor: numeros.analisadas, icone: Brain, cor: 'bg-violet-500/15 text-violet-300', hex: '#a78bfa', ativo: numeros.analisando },
    cliente: { titulo: 'Cliente', legenda: 'WhatsApp · ChatGuru', valor: numeros.cliente, icone: MessageCircle, cor: 'bg-emerald-500/15 text-emerald-300', hex: '#34d399' },
    empresa: { titulo: 'Empresa', legenda: 'E-mail + recortes', valor: numeros.empresa, icone: Building2, cor: 'bg-indigo-500/15 text-indigo-300', hex: '#818cf8' },
    conferencia: { titulo: 'Conferência', legenda: 'Funcionário revisa', valor: numeros.conferencia, icone: ClipboardCheck, cor: 'bg-amber-500/15 text-amber-300', hex: '#fbbf24', ativo: numeros.conferencia > 0 },
    enviadas: { titulo: 'Enviadas', legenda: 'Comentado na tarefa', valor: numeros.enviadas, icone: CheckCircle2, cor: 'bg-teal-500/15 text-teal-300', hex: '#2dd4bf' },
  };

  return (
    <>
      {/* Telas grandes: fluxo na horizontal */}
      <div className="hidden items-stretch lg:flex">
        <div className="flex min-w-0 flex-1 items-center"><No etapa={etapas.lawyertool} indice={0} /></div>
        <Feixe hex="#38bdf8" />
        <div className="flex min-w-0 flex-1 items-center"><No etapa={etapas.ia} indice={1} /></div>
        <Feixe hex="#a78bfa" atraso={0.3} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <No etapa={etapas.cliente} indice={2} />
          <No etapa={etapas.empresa} indice={3} />
        </div>
        <Feixe hex="#34d399" atraso={0.6} />
        <div className="flex min-w-0 flex-1 items-center"><No etapa={etapas.conferencia} indice={4} /></div>
        <Feixe hex="#fbbf24" atraso={0.9} />
        <div className="flex min-w-0 flex-1 items-center"><No etapa={etapas.enviadas} indice={5} /></div>
      </div>

      {/* Celular e tablet: fluxo na vertical */}
      <div className="flex flex-col items-stretch lg:hidden">
        <No etapa={etapas.lawyertool} indice={0} />
        <Feixe hex="#38bdf8" vertical />
        <No etapa={etapas.ia} indice={1} />
        <Feixe hex="#a78bfa" vertical atraso={0.3} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <No etapa={etapas.cliente} indice={2} />
          <No etapa={etapas.empresa} indice={3} />
        </div>
        <Feixe hex="#34d399" vertical atraso={0.6} />
        <No etapa={etapas.conferencia} indice={4} />
        <Feixe hex="#fbbf24" vertical atraso={0.9} />
        <No etapa={etapas.enviadas} indice={5} />
      </div>
    </>
  );
}

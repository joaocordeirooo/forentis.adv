import { Building2, CircleHelp, MessageCircle, type LucideIcon } from 'lucide-react';
import type { Solicitacao, TipoSolicitacao } from '@/models/solicitacao.model';

// Como cada tipo de pendência aparece no painel.
export const VISUAL_TIPO: Record<TipoSolicitacao, { rotulo: string; icone: LucideIcon; classe: string; spot: string; foco: string }> = {
  cliente: { rotulo: 'Cliente', icone: MessageCircle, classe: 'bg-emerald-500/15 text-emerald-300', spot: 'rgba(52,211,153,0.15)', foco: 'focus:border-emerald-500' },
  empresa: { rotulo: 'Empresa', icone: Building2, classe: 'bg-indigo-500/15 text-indigo-300', spot: 'rgba(129,140,248,0.18)', foco: 'focus:border-indigo-500' },
  indefinida: { rotulo: 'Não classificada', icone: CircleHelp, classe: 'bg-amber-500/15 text-amber-300', spot: 'rgba(251,191,36,0.15)', foco: 'focus:border-amber-500' },
};

// Nome curto mostrado no cartão/chip.
export function tituloSolicitacao(s: Pick<Solicitacao, 'tipo' | 'clienteNome' | 'empresa'>): string {
  if (s.tipo === 'cliente') return s.clienteNome ?? 'Cliente';
  if (s.tipo === 'empresa') return s.empresa ?? 'Empresa não identificada';
  return 'Sem destinatário definido';
}

export const STATUS_ABERTOS_PAINEL = ['aguardando_conferencia', 'bloqueada', 'falha_envio'];

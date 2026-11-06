import type { StatusSolicitacao } from '@/models/solicitacao.model';

export const ROTULO_STATUS: Record<StatusSolicitacao, string> = {
  aguardando_conferencia: 'Aguardando conferência',
  bloqueada: 'Bloqueada',
  concluida: 'Concluída',
  falha_envio: 'Falha no envio',
  descartada: 'Descartada',
  substituida: 'Substituída',
};

export const COR_STATUS: Record<StatusSolicitacao, string> = {
  aguardando_conferencia: 'text-violet-300 bg-violet-500/10 ring-violet-500/30',
  bloqueada: 'text-amber-300 bg-amber-500/10 ring-amber-500/30',
  concluida: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/30',
  falha_envio: 'text-rose-300 bg-rose-500/10 ring-rose-500/30',
  descartada: 'text-zinc-400 bg-zinc-500/10 ring-zinc-500/30',
  substituida: 'text-zinc-400 bg-zinc-500/10 ring-zinc-500/30',
};

export const ROTULO_DECISAO: Record<string, string> = {
  preparar_pendencias: 'Preparar pendências',
  consultar_arquivos: 'Consultar arquivos',
  conferencia_humana: 'Conferência humana',
  nenhuma_acao: 'Nenhuma ação',
  erro_analise: 'Erro na análise',
  erro_contexto: 'Erro no contexto',
  erro_triagem: 'Erro na triagem',
  sem_mudanca: 'Sem novidades',
  triagem_sem_pedido: 'Triagem: sem pedido externo',
};

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function relativo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const segundos = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (segundos < 60) return 'agora';
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `há ${Math.floor(segundos / 3600)} h`;
  return `há ${Math.floor(segundos / 86400)} d`;
}

export function telefone(numero: string | null | undefined): string {
  if (!numero) return '—';
  const m = numero.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : numero;
}

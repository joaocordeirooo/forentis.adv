'use client';

import { FileText, Loader2, Paperclip } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { abrirArquivo } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { AnexoRegistrado, StatusConversa, TipoRecebido } from '@/models/email.model';

// Peças usadas em mais de uma tela da estação E-mails.

export const ROTULO_STATUS_CONVERSA: Record<StatusConversa, string> = {
  enviado: 'Aguardando resposta',
  respondido: 'Respondido',
  devolvido: 'Devolvido',
  falhou: 'Não enviado',
};

export const COR_STATUS_CONVERSA: Record<StatusConversa, { selo: string; ponto: string }> = {
  enviado: { selo: 'text-sky-300 bg-sky-500/10 ring-sky-500/30', ponto: 'bg-sky-400' },
  respondido: { selo: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/30', ponto: 'bg-emerald-400' },
  devolvido: { selo: 'text-orange-300 bg-orange-500/10 ring-orange-500/30', ponto: 'bg-orange-400' },
  falhou: { selo: 'text-rose-300 bg-rose-500/10 ring-rose-500/30', ponto: 'bg-rose-400' },
};

export const ROTULO_TIPO_RECEBIDO: Record<TipoRecebido, string> = {
  resposta: 'Resposta',
  automatica: 'Resposta automática',
  devolucao: 'Devolução',
};

export const COR_TIPO_RECEBIDO: Record<TipoRecebido, string> = {
  resposta: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/30',
  automatica: 'text-zinc-300 bg-zinc-500/10 ring-zinc-500/30',
  devolucao: 'text-orange-300 bg-orange-500/10 ring-orange-500/30',
};

export function SeloConversa({ status, className }: { status: StatusConversa; className?: string }) {
  const cor = COR_STATUS_CONVERSA[status];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', cor.selo, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cor.ponto, status === 'enviado' && 'animate-pulse-soft')} />
      {ROTULO_STATUS_CONVERSA[status]}
    </span>
  );
}

export function SeloTipo({ tipo }: { tipo: TipoRecebido }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', COR_TIPO_RECEBIDO[tipo])}>
      {ROTULO_TIPO_RECEBIDO[tipo]}
    </span>
  );
}

// Nome de quem está usando o painel: o mesmo guardado pelas outras telas.
const CHAVE_FUNCIONARIO = 'forentis.funcionario';

export function lerFuncionario(): string {
  try {
    return localStorage.getItem(CHAVE_FUNCIONARIO) ?? '';
  } catch {
    return '';
  }
}

export function guardarFuncionario(nome: string) {
  try {
    localStorage.setItem(CHAVE_FUNCIONARIO, nome.trim());
  } catch {
    /* sem armazenamento */
  }
}

export const estiloCampo =
  'w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500';

export function Campo({ rotulo, dica, children, className }: { rotulo: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs text-zinc-400">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[11px] text-zinc-500">{dica}</span>}
    </label>
  );
}

export function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Anexo: com url abre numa aba nova (passando a chave da API); sem url só mostra o nome (anexos enviados não ficam guardados).
export function ChipAnexo({ anexo, url }: { anexo: AnexoRegistrado; url?: string | null }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const disponivel = Boolean(url) && anexo.arquivo !== null;
  const Icone = anexo.mimeType === 'application/pdf' ? FileText : Paperclip;
  const conteudo = (
    <>
      {abrindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icone className="h-3.5 w-3.5" />}
      <span className="max-w-56 truncate">{anexo.nome}</span>
      <span className="text-zinc-500">{tamanho(anexo.tamanho)}</span>
    </>
  );
  if (!disponivel) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-zinc-400 ring-1 ring-inset ring-white/10"
        title={anexo.arquivo === null ? 'Anexo grande demais: não foi guardado' : undefined}
      >
        {conteudo}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={async () => {
        setAbrindo(true);
        setErro(null);
        try {
          await abrirArquivo(url!);
        } catch (e) {
          setErro((e as Error).message);
        } finally {
          setAbrindo(false);
        }
      }}
      title={erro ?? 'Abrir anexo'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ring-1 ring-inset transition-colors',
        erro ? 'bg-rose-500/10 text-rose-200 ring-rose-500/30' : 'bg-violet-500/10 text-violet-200 ring-violet-500/30 hover:bg-violet-500/20',
      )}
    >
      {conteudo}
    </button>
  );
}

export function Vazio({ icone: Icone, texto, children }: { icone: React.ComponentType<{ className?: string }>; texto: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <Icone className="mx-auto h-8 w-8 text-zinc-600" />
      <p className="mt-3 text-sm text-zinc-400">{texto}</p>
      {children}
    </div>
  );
}

'use client';

import { motion } from 'motion/react';
import { Mail, Paperclip, Reply } from 'lucide-react';
import { relativo } from '@/lib/formato';
import type { ConversaEmail } from '@/models/email.model';
import { SeloConversa, Vazio } from './comum';

// Lista das conversas (um pedido por linha).

function ultimaAtividade(c: ConversaEmail): string {
  return [c.ultimaRespostaEm, c.ultimoEnvioEm, c.atualizadaEm].filter(Boolean).sort().at(-1) ?? c.criadaEm;
}

export function ListaConversas({ conversas, aoAbrir, temFiltro }: { conversas: ConversaEmail[]; aoAbrir: (id: string) => void; temFiltro: boolean }) {
  if (!conversas.length) {
    return <Vazio icone={Mail} texto={temFiltro ? 'Nenhuma conversa neste filtro.' : 'Nenhum e-mail enviado pelo Forentis ainda.'} />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60">
      <ul className="divide-y divide-white/5">
        {conversas.map((c, i) => {
          const novas = c.respostasNovas ?? 0;
          const anexosRecebidos = c.mensagens.filter((m) => m.direcao === 'entrada').reduce((s, m) => s + m.anexos.length, 0);
          return (
            <motion.li key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.015 }}>
              <button
                onClick={() => aoAbrir(c.id)}
                className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {novas > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950">
                        <Reply className="h-3 w-3" /> {novas}
                      </span>
                    )}
                    <p className={novas > 0 ? 'truncate font-semibold text-white' : 'truncate font-medium text-zinc-100'}>{c.assunto}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    <span className="font-mono text-zinc-400">{c.codigo}</span>
                    {' · '}
                    {c.vinculo.empresa ?? c.destinatarios.para.join(', ')}
                    {c.vinculo.tarefaId ? ` · tarefa #${c.vinculo.tarefaId}` : ''}
                    {c.modoTeste ? ' · teste' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 sm:justify-end">
                  {anexosRecebidos > 0 && (
                    <span className="inline-flex items-center gap-1 text-violet-300" title="Anexos recebidos">
                      <Paperclip className="h-3.5 w-3.5" /> {anexosRecebidos}
                    </span>
                  )}
                  <span className="tabular-nums" title="Envios (primeiro + lembretes)">
                    {c.envios}× enviado
                  </span>
                  <span className="w-16 text-right tabular-nums">{relativo(ultimaAtividade(c))}</span>
                  <SeloConversa status={c.status} />
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

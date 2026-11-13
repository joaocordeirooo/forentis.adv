'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Ban, Building2, Check, Loader2, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Etiqueta } from '@/components/ui/selo-status';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { textoPeriodo } from '@/utils/texto.util';
import type { Solicitacao } from '@/models/solicitacao.model';

// Pendências que a IA não soube dizer se são do cliente ou de uma empresa.
// Cada uma vira pedido ao cliente, pedido a uma empresa (junta no pedido aberto dela ou cria um novo) ou é ignorada.
export function ClassificarPendencias({
  solicitacao: s,
  aberta,
  funcionario,
  aoAtualizar,
  aoErro,
}: {
  solicitacao: Solicitacao;
  aberta: boolean;
  funcionario: string;
  aoAtualizar: (s: Solicitacao) => void;
  aoErro: (mensagem: string) => void;
}) {
  const [empresaAberta, setEmpresaAberta] = useState<number | null>(null);
  const [nomes, setNomes] = useState<Record<number, string>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);

  // Sugestões: empresas que a IA já identificou nas outras pendências da mesma tarefa.
  const sugestoes = [...new Set(s.pendencias.map((p) => p.destinatario_nome).filter((n): n is string => Boolean(n)))];

  async function classificar(indice: number, destino: 'cliente' | 'empresa' | 'ignorar') {
    if (funcionario.trim().length < 2) return aoErro('Informe seu nome antes (campo no rodapé).');
    const empresa = destino === 'empresa' ? nomes[indice]?.trim() : undefined;
    if (destino === 'empresa' && (!empresa || empresa.length < 2)) return aoErro('Informe o nome da empresa.');
    setOcupado(indice);
    try {
      aoAtualizar(await api.classificar(s.id, { por: funcionario.trim(), indice, destino, ...(empresa ? { empresa } : {}) }));
      setEmpresaAberta(null);
    } catch (e) {
      aoErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        A IA encontrou estas pendências mas não definiu para quem pedir. Escolha o destino de cada uma: ela entra no pedido aberto do cliente ou da empresa (ou cria um novo, que aparece ao lado na conferência).
      </p>
      <ul className="space-y-3">
        {s.pendencias.map((p, i) => {
          const feita = p.classificacao;
          return (
            <li key={i} className={cn('rounded-xl border p-3 transition-colors', feita ? 'border-white/5 bg-black/10 opacity-70' : 'border-amber-500/20 bg-amber-500/[0.04]')}>
              <p className="text-sm text-zinc-100">{p.documento || 'Sem descrição'}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {textoPeriodo(p.periodo) && <Etiqueta>{textoPeriodo(p.periodo)}</Etiqueta>}
                {p.destinatario_nome && <Etiqueta>citado: {p.destinatario_nome}</Etiqueta>}
              </div>
              {p.fontes?.slice(0, 2).map((f, j) => (
                <blockquote key={j} className="mt-2 border-l-2 border-amber-500/40 pl-3 text-xs italic text-zinc-400">“{f.trecho}”</blockquote>
              ))}

              {feita ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {feita.destino === 'cliente' ? 'Enviada para o pedido ao cliente' : feita.destino === 'empresa' ? `Enviada para o pedido à empresa ${feita.empresa}` : 'Ignorada'} · {feita.por}
                </p>
              ) : aberta ? (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={ocupado !== null} onClick={() => classificar(i, 'cliente')} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-50">
                      {ocupado === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />} Cliente
                    </button>
                    <button
                      disabled={ocupado !== null}
                      onClick={() => {
                        setEmpresaAberta(empresaAberta === i ? null : i);
                        if (!nomes[i] && p.destinatario_nome) setNomes({ ...nomes, [i]: p.destinatario_nome });
                      }}
                      className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-indigo-200 ring-1 ring-indigo-500/30 hover:bg-indigo-500/10 disabled:opacity-50', empresaAberta === i && 'bg-indigo-500/10')}
                    >
                      <Building2 className="h-3.5 w-3.5" /> Empresa
                    </button>
                    <button disabled={ocupado !== null} onClick={() => classificar(i, 'ignorar')} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-50">
                      <Ban className="h-3.5 w-3.5" /> Ignorar
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {empresaAberta === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="flex gap-2 pt-1">
                          <input
                            autoFocus
                            list={`empresas-${s.id}`}
                            placeholder="Nome da empresa"
                            value={nomes[i] ?? ''}
                            onChange={(e) => setNomes({ ...nomes, [i]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && classificar(i, 'empresa')}
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                          />
                          <button disabled={ocupado !== null} onClick={() => classificar(i, 'empresa')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                            {ocupado === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <datalist id={`empresas-${s.id}`}>{sugestoes.map((n) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}

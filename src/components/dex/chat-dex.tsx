'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, RotateCcw, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { MensagemDex } from '@/models/dex.model';
import { TextoDex } from './texto-dex';

const CHAVE_CONVERSA = 'forentis.dex.conversa';
const SUGESTOES = [
  'O que está aguardando conferência?',
  'A última análise deixou alguma tarefa sem tratar?',
  'Quais tarefas do atendimento são para hoje?',
  'Como funciona a trava dos 3 envios ao cliente?',
];

const NOMES_CONSULTA: Record<string, string> = {
  resumo_geral: 'panorama',
  listar_solicitacoes: 'solicitações',
  detalhar_solicitacao: 'solicitação',
  execucoes_analise: 'execuções',
  consultar_tarefa: 'tarefa',
  atendimento_semana: 'atendimento',
  buscar_contato_empresa: 'contatos',
  consultar_guia: 'guia do sistema',
};

const ler = (chave: string) => {
  try { return localStorage.getItem(chave) ?? ''; } catch { return ''; }
};
const gravar = (chave: string, valor: string) => {
  try { localStorage.setItem(chave, valor); } catch { /* ignora */ }
};

function Avatar() {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 text-sm font-bold text-white shadow-lg shadow-violet-500/30">
      D
    </span>
  );
}

export function ChatDex({ className }: { className?: string }) {
  const [mensagens, setMensagens] = useState<MensagemDex[]>([]);
  const [conversaId, setConversaId] = useState('');
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  // Retoma a última conversa desta pessoa.
  useEffect(() => {
    const id = ler(CHAVE_CONVERSA);
    if (!id) return;
    setConversaId(id);
    api.conversaDex(id).then((c) => setMensagens(c.mensagens)).catch(() => gravar(CHAVE_CONVERSA, ''));
  }, []);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, pensando]);

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || pensando) return;
    setTexto('');
    setErro(null);
    setMensagens((m) => [...m, { papel: 'pessoa', texto: limpa, em: new Date().toISOString() }]);
    setPensando(true);
    try {
      const nome = ler('forentis.funcionario') || undefined;
      const r = await api.perguntarDex(limpa, conversaId || undefined, nome);
      setConversaId(r.conversaId);
      gravar(CHAVE_CONVERSA, r.conversaId);
      setMensagens((m) => [...m, r.resposta]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPensando(false);
    }
  }

  function novaConversa() {
    gravar(CHAVE_CONVERSA, '');
    setConversaId('');
    setMensagens([]);
    setErro(null);
  }

  return (
    <section className={cn('flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90', className)}>
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">DEX</p>
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> assistente do escritório · só consulta
          </p>
        </div>
        {mensagens.length > 0 && (
          <button onClick={novaConversa} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200" title="Nova conversa">
            <RotateCcw className="h-3.5 w-3.5" /> Nova
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
        {mensagens.length === 0 && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <Avatar />
              <div className="rounded-2xl rounded-tl-sm bg-white/5 px-3.5 py-2.5 text-zinc-200">
                Oi! Eu sou a <strong className="text-white">DEX</strong>. Consulto o sistema para você: solicitações, execuções da análise, tarefas e o atendimento da semana. O que você quer saber?
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-11">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => enviar(s)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-violet-400/50 hover:bg-violet-500/10">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {mensagens.map((m, i) =>
            m.papel === 'pessoa' ? (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-violet-600 px-3.5 py-2.5 text-white">{m.texto}</div>
              </motion.div>
            ) : (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <Avatar />
                <div className="min-w-0 max-w-[85%] space-y-1.5">
                  <div className="rounded-2xl rounded-tl-sm bg-white/5 px-3.5 py-2.5 text-zinc-200">
                    <TextoDex texto={m.texto} />
                  </div>
                  {m.consultas && m.consultas.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1 pl-1 text-[11px] text-zinc-500">
                      <Search className="h-3 w-3" /> consultou: {m.consultas.map((c) => NOMES_CONSULTA[c] ?? c).join(', ')}
                    </p>
                  )}
                </div>
              </motion.div>
            ),
          )}
        </AnimatePresence>

        {pensando && (
          <div className="flex gap-3">
            <Avatar />
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-zinc-300" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        {erro && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{erro}</p>}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex items-end gap-2 border-t border-white/5 p-3"
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar(texto);
            }
          }}
          rows={1}
          placeholder="Pergunte para a DEX…"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500"
        />
        <button type="submit" disabled={!texto.trim() || pensando} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40" aria-label="Enviar">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

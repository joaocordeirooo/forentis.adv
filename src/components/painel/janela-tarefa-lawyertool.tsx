'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ExternalLink, Loader2, MessageSquare, RefreshCw, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { SeloStatus } from '@/components/ui/selo-status';
import { api } from '@/lib/api-client';
import { dataHora } from '@/lib/formato';
import { linkTarefaLawyertool } from '@/lib/lawyertool-link';
import { cn } from '@/lib/utils';
import type { StatusSolicitacao } from '@/models/solicitacao.model';
import type { TarefaDetalhe } from '@/models/tarefa-detalhe.model';
import { VISUAL_TIPO } from './tipo-solicitacao';

// A tarefa "na íntegra", no mesmo arranjo da tela de cadastro de tarefa do Lawyertool (só leitura).

const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  pendente: { rotulo: 'Pendente', cor: 'bg-amber-500/10 text-amber-300' },
  iniciada: { rotulo: 'Iniciada', cor: 'bg-sky-500/10 text-sky-300' },
  bloqueada: { rotulo: 'Bloqueada', cor: 'bg-rose-500/10 text-rose-300' },
  concluida: { rotulo: 'Concluída', cor: 'bg-emerald-500/10 text-emerald-300' },
  cancelada: { rotulo: 'Cancelada', cor: 'bg-zinc-500/10 text-zinc-400' },
};
const PRIORIDADE: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };

const data = (v: string | null) => (v ? (v.length <= 10 ? new Date(`${v}T12:00`).toLocaleDateString('pt-BR') : dataHora(v.replace(' ', 'T'))) : null);

// Campo no estilo do formulário do Lawyertool: rótulo pequeno em cima, valor dentro da caixa.
function Campo({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2', className)}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{rotulo}</p>
      <div className="mt-0.5 truncate text-sm text-zinc-100">{children ?? <span className="text-zinc-600">—</span>}</div>
    </div>
  );
}

function Secao({ titulo, children, inicial = true }: { titulo: ReactNode; children: ReactNode; inicial?: boolean }) {
  const [aberta, setAberta] = useState(inicial);
  return (
    <section className="rounded-2xl border border-white/10">
      <button onClick={() => setAberta(!aberta)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-200">
        {titulo}
        <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition', aberta && 'rotate-180')} />
      </button>
      {aberta && <div className="border-t border-white/5 px-4 py-3">{children}</div>}
    </section>
  );
}

export function JanelaTarefaLawyertool({ tarefaId, aoFechar }: { tarefaId: number | null; aoFechar: () => void }) {
  const [t, setT] = useState<TarefaDetalhe | null>(null);
  const [erro, setErro] = useState<Error | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!tarefaId) return;
    let ativo = true;
    api
      .tarefaDetalhe(tarefaId)
      .then((d) => { if (ativo) { setT(d); setErro(null); } })
      .catch((e) => ativo && setErro(e as Error));
    return () => {
      ativo = false;
    };
  }, [tarefaId, recarga]);

  // Esc fecha.
  useEffect(() => {
    if (!tarefaId) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [tarefaId, aoFechar]);

  const atual = t && t.id === tarefaId ? t : null; // não mostra a tarefa anterior enquanto carrega a nova
  const situacao = atual?.situacao ? SITUACAO[atual.situacao] : null;

  return (
    <AnimatePresence>
      {tarefaId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={aoFechar} className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-8">
          <motion.div
            initial={{ y: 20, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h2 className="font-semibold text-white">Tarefa #{tarefaId}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setRecarga((n) => n + 1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" title="Recarregar do Lawyertool">
                  <RefreshCw className="h-4 w-4" />
                </button>
                <a href={linkTarefaLawyertool(tarefaId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500">
                  Abrir no Lawyertool <ExternalLink className="h-4 w-4" />
                </a>
                <button onClick={aoFechar} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
              </div>
            </header>

            <div className="space-y-4 p-5">
              <AvisoErro erro={erro} />
              {!atual && !erro && <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>}

              {atual && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Campo rotulo="Código">{atual.id}</Campo>
                    <Campo rotulo="Situação">
                      {situacao ? <span className={cn('rounded-md px-2 py-0.5 text-xs', situacao.cor)}>{situacao.rotulo}</span> : atual.situacao}
                      {atual.atrasada && <span className="ml-2 text-xs text-rose-300">atrasada {atual.diasAtraso ?? ''} dia(s)</span>}
                    </Campo>
                    <Campo rotulo="Prioridade">{atual.prioridade ? PRIORIDADE[atual.prioridade] ?? atual.prioridade : null}</Campo>
                    <Campo rotulo="Destacar">{atual.destaca ? 'Sim' : 'Não'}</Campo>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <Campo rotulo="Setor">{atual.setor ? `${atual.setor.id} - ${atual.setor.nome}` : null}</Campo>
                    <Campo rotulo="Fluxo">{atual.fluxo ? `${atual.fluxo.id} - ${atual.fluxo.nome}` : null}</Campo>
                    <Campo rotulo="Tipo de tarefa">{atual.tipoTarefa ? `${atual.tipoTarefa.id} - ${atual.tipoTarefa.nome}` : null}</Campo>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <Campo rotulo="Pessoa">{atual.pessoa ? `${atual.pessoa.id} - ${atual.pessoa.nome}` : null}</Campo>
                    <Campo rotulo="Processo">{atual.processo ? `${atual.processo.id} - ${atual.processo.numero || 'Não informado'}` : null}</Campo>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <Campo rotulo="Usuário responsável">{atual.usuarioResponsavel?.nome}</Campo>
                    <Campo rotulo="Responsáveis">{atual.responsaveis.length ? atual.responsaveis.join(', ') : null}</Campo>
                    <Campo rotulo="Solicitante">{atual.usuarioSolicitante?.nome}</Campo>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Campo rotulo="Data final esperada">{data(atual.datas.finalEsperada)}</Campo>
                    <Campo rotulo="Início">{data(atual.datas.inicio)}</Campo>
                    <Campo rotulo="Data final real">{data(atual.datas.finalReal)}</Campo>
                    <Campo rotulo={atual.subtarefa ? 'Tarefa pai' : 'Subtarefa'}>{atual.subtarefa ? (atual.tarefaPai ? `#${atual.tarefaPai.id} - ${atual.tarefaPai.nome}` : 'Sim') : 'Não'}</Campo>
                  </div>

                  <Campo rotulo="Título">{atual.titulo}</Campo>

                  <div className="rounded-xl border border-white/10 bg-zinc-900/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Descrição</p>
                    <p className="mt-1 min-h-16 whitespace-pre-line text-sm leading-relaxed text-zinc-200">{atual.descricao || <span className="text-zinc-600">Sem descrição.</span>}</p>
                  </div>

                  <p className="text-xs text-zinc-500">
                    Criado por {atual.criadoPor ?? '—'} em {data(atual.datas.cadastro) ?? '—'}
                    {atual.alteradoPor || atual.datas.alteracao ? `. Atualizado por ${atual.alteradoPor ?? '—'} em ${data(atual.datas.alteracao) ?? '—'}` : ''}.
                  </p>

                  {atual.avisos.length > 0 && <p className="text-xs text-amber-300">{atual.avisos.join(' ')}</p>}

                  {atual.solicitacoes.length > 0 && (
                    <Secao titulo={`Pedidos preparados pelo Forentis (${atual.solicitacoes.length})`}>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {atual.solicitacoes.map((s) => {
                          const visual = VISUAL_TIPO[s.tipo as keyof typeof VISUAL_TIPO] ?? VISUAL_TIPO.empresa;
                          const Icone = visual.icone;
                          return (
                            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                              <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', visual.classe)}><Icone className="h-3.5 w-3.5" /></span>
                              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{s.titulo}</span>
                              <SeloStatus status={s.status as StatusSolicitacao} />
                            </li>
                          );
                        })}
                      </ul>
                    </Secao>
                  )}

                  <Secao titulo={<span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-violet-300" /> Comentários ({atual.comentarios.length})</span>}>
                    {atual.comentarios.length ? (
                      <ol className="space-y-3">
                        {atual.comentarios.map((c) => (
                          <li key={c.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
                            <p className="text-xs text-zinc-500">{c.usuario ?? '—'} · {data(c.em)}</p>
                            <p className="mt-1 whitespace-pre-line text-sm text-zinc-200">{c.conteudo}</p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-zinc-500">Nenhum comentário.</p>
                    )}
                  </Secao>

                  <Secao titulo={`Histórico (${atual.historico.length})`} inicial={false}>
                    {atual.historico.length ? (
                      <ol className="relative space-y-3 border-l border-white/10 pl-5">
                        {atual.historico.map((h) => (
                          <li key={h.id} className="relative">
                            <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-violet-400 ring-4 ring-zinc-950" />
                            <p className="text-sm text-zinc-200">
                              {h.acao ?? 'Alteração'}{h.campo ? ` · ${h.campo}` : ''}
                              {h.de || h.para ? <span className="text-zinc-400"> ({h.de ?? '—'} → {h.para ?? '—'})</span> : null}
                            </p>
                            <p className="text-xs text-zinc-500">{h.usuario ?? '—'} · {data(h.em)}{h.descricao ? ` — ${h.descricao}` : ''}</p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-zinc-500">Sem histórico.</p>
                    )}
                  </Secao>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

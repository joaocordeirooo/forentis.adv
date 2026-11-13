'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Building2, ChevronRight, CircleHelp, MessageCircle, Paperclip, ShieldAlert, User, X } from 'lucide-react';
import { LinkTarefaLawyertool } from '@/components/ui/link-lawyertool';
import { Etiqueta, SeloStatus } from '@/components/ui/selo-status';
import { dataHora, relativo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Solicitacao } from '@/models/solicitacao.model';
import { STATUS_ABERTOS_PAINEL, tituloSolicitacao, VISUAL_TIPO } from './tipo-solicitacao';

const ORDEM_TIPO = { cliente: 0, empresa: 1, indefinida: 2 } as const;
const ARQUIVADAS = ['descartada', 'substituida'];
const aberta = (s: Solicitacao) => STATUS_ABERTOS_PAINEL.includes(s.status);

export interface GrupoTarefa {
  tarefaId: number;
  itens: Solicitacao[];
  abertas: number;
  maisRecente: string;
  base: Solicitacao; // dados da tarefa (cliente, processo, tipo, responsável)
  tipoTarefa: string; // descrição do tipo de tarefa (para filtrar)
  solicitadoPor: string | null;
}

// Uma "pasta" por tarefa: o pedido ao cliente, o de cada empresa e as pendências não classificadas.
export function agruparPorTarefa(lista: Solicitacao[], incluirConcluidas = false): GrupoTarefa[] {
  const grupos = new Map<number, Solicitacao[]>();
  for (const s of lista) {
    if (ARQUIVADAS.includes(s.status)) continue;
    grupos.set(s.tarefaId, [...(grupos.get(s.tarefaId) ?? []), s]);
  }
  return [...grupos.entries()]
    .map(([tarefaId, itens]) => {
      const ordenados = itens.sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || (a.empresa ?? '').localeCompare(b.empresa ?? '', 'pt-BR'));
      const base = ordenados[0];
      return {
        tarefaId,
        itens: ordenados,
        abertas: itens.filter(aberta).length,
        maisRecente: itens.reduce((m, s) => (s.criadaEm > m ? s.criadaEm : m), ''),
        base,
        tipoTarefa: base.origem?.tipoTarefa?.descricao ?? base.tarefaTitulo ?? 'Tipo não informado',
        solicitadoPor: itens.find((s) => s.solicitadoPor)?.solicitadoPor ?? null,
      };
    })
    .filter((g) => incluirConcluidas || g.abertas > 0)
    .sort((a, b) => b.maisRecente.localeCompare(a.maisRecente));
}

// Resumo dos pedidos da pasta em ícones (cliente / empresas / a classificar).
function ResumoPedidos({ g }: { g: GrupoTarefa }) {
  const cliente = g.itens.filter((s) => s.tipo === 'cliente');
  const empresas = g.itens.filter((s) => s.tipo === 'empresa');
  const aClassificar = g.itens.filter((s) => s.tipo === 'indefinida' && aberta(s)).reduce((n, s) => n + s.pendencias.filter((p) => !p.classificacao).length, 0);
  const item = (Icone: typeof User, cor: string, texto: string, pendente: boolean) => (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs', pendente ? cor : 'text-zinc-500')}>
      <Icone className="h-3.5 w-3.5" /> {texto}
    </span>
  );
  return (
    <span className="flex flex-wrap gap-1.5">
      {cliente.length > 0 && item(MessageCircle, 'bg-emerald-500/10 text-emerald-300', 'cliente', cliente.some(aberta))}
      {empresas.length > 0 && item(Building2, 'bg-indigo-500/10 text-indigo-300', `${empresas.length} empresa(s)`, empresas.some(aberta))}
      {aClassificar > 0 && item(CircleHelp, 'bg-amber-500/10 text-amber-300', `${aClassificar} a classificar`, true)}
    </span>
  );
}

// Listagem das pastas: uma linha por tarefa. Clique abre a janela da tarefa.
export function ListaTarefasExecutadas({ grupos, aoAbrir, vazio }: { grupos: GrupoTarefa[]; aoAbrir: (tarefaId: number) => void; vazio: string }) {
  if (!grupos.length) {
    return <div className="grid h-32 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">{vazio}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/80">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Cliente</th>
            <th className="px-3 py-2.5 font-medium">Tipo de tarefa</th>
            <th className="px-3 py-2.5 font-medium">Pedidos</th>
            <th className="px-3 py-2.5 font-medium">Andamento</th>
            <th className="px-3 py-2.5 font-medium">Pedido por</th>
            <th className="px-3 py-2.5 font-medium">Preparada</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {grupos.map((g, i) => {
            const bloqueios = g.itens.filter((s) => s.status === 'bloqueada').length;
            const feitos = g.itens.length - g.abertas;
            return (
              <motion.tr
                key={g.tarefaId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.2) }}
                onClick={() => aoAbrir(g.tarefaId)}
                className="group cursor-pointer transition-colors hover:bg-white/[0.04]"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-100">{g.base.clienteNome ?? 'Cliente não identificado'}</p>
                  <p className="text-xs text-zinc-500">Tarefa #{g.tarefaId} · Processo {g.base.processoId}{g.base.responsavel ? ` · ${g.base.responsavel}` : ''}</p>
                </td>
                <td className="max-w-64 truncate px-3 py-3 text-zinc-300" title={g.tipoTarefa}>{g.tipoTarefa}</td>
                <td className="px-3 py-3"><ResumoPedidos g={g} /></td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(feitos / g.itens.length) * 100}%` }} />
                    </span>
                    <span className="tabular-nums text-xs text-zinc-400">{feitos}/{g.itens.length}</span>
                    {bloqueios > 0 && <span className="inline-flex items-center gap-1 text-xs text-amber-300"><ShieldAlert className="h-3.5 w-3.5" /> {bloqueios}</span>}
                  </span>
                </td>
                <td className="px-3 py-3 text-zinc-300">{g.solicitadoPor ?? <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-3 text-xs text-zinc-400" title={dataHora(g.maisRecente)}>{relativo(g.maisRecente)}</td>
                <td className="px-3 py-3 text-zinc-600 group-hover:text-zinc-300"><ChevronRight className="h-4 w-4" /></td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pedido({ s, aoAbrir }: { s: Solicitacao; aoAbrir: () => void }) {
  const visual = VISUAL_TIPO[s.tipo];
  const Icone = visual.icone;
  const estaAberta = aberta(s);
  const aClassificar = s.tipo === 'indefinida' ? s.pendencias.filter((p) => !p.classificacao).length : 0;
  return (
    <button onClick={aoAbrir} className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', estaAberta ? 'border-white/10 bg-black/30 hover:border-white/25' : 'border-white/5 bg-black/10 opacity-60 hover:opacity-90')}>
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', visual.classe)}>
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-zinc-500">{visual.rotulo}</span>
        <span className="block truncate text-sm font-medium text-zinc-100">{s.tipo === 'cliente' ? 'Mensagem ao cliente' : tituloSolicitacao(s)}</span>
        <span className="mt-0.5 line-clamp-3 block text-xs text-zinc-400">{s.tipo === 'cliente' ? s.texto : s.pendencias.map((p) => p.documento).join('; ')}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <SeloStatus status={s.status} />
          {aClassificar > 0 && <span className="text-xs text-amber-300">{aClassificar} a classificar</span>}
          {s.bloqueios.length > 0 && estaAberta && <span className="inline-flex items-center gap-1 text-xs text-amber-300"><ShieldAlert className="h-3.5 w-3.5" /> {s.bloqueios.length}</span>}
          {s.anexos.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-zinc-400"><Paperclip className="h-3.5 w-3.5" /> {s.anexos.length}</span>}
        </span>
      </span>
    </button>
  );
}

// Janela da tarefa: tudo o que a IA preparou nela. Cada pedido abre o painel de conferência por cima.
export function JanelaTarefa({ grupo, aoFechar, aoAbrirPedido }: { grupo: GrupoTarefa | null; aoFechar: () => void; aoAbrirPedido: (id: string) => void }) {
  return (
    <AnimatePresence>
      {grupo && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={aoFechar} className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-8">
          <motion.div
            initial={{ y: 20, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-semibold text-white"><User className="h-5 w-5 text-zinc-500" /> {grupo.base.clienteNome ?? 'Cliente não identificado'}</p>
                <p className="mt-0.5 text-sm text-zinc-400">{grupo.tipoTarefa}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Etiqueta><LinkTarefaLawyertool tarefaId={grupo.tarefaId} texto={`Tarefa #${grupo.tarefaId}`} /></Etiqueta>
                  <Etiqueta>Processo {grupo.base.processoId}</Etiqueta>
                  {grupo.base.origem?.setor && <Etiqueta>{grupo.base.origem.setor.descricao}</Etiqueta>}
                  {grupo.base.origem?.fluxo && <Etiqueta>{grupo.base.origem.fluxo.descricao}</Etiqueta>}
                  {grupo.base.responsavel && <Etiqueta>Resp.: {grupo.base.responsavel}</Etiqueta>}
                  {grupo.solicitadoPor && <Etiqueta className="text-violet-200">Pedido por {grupo.solicitadoPor}</Etiqueta>}
                </div>
              </div>
              <div className="flex shrink-0 items-start gap-3">
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums text-white">{grupo.itens.length - grupo.abertas}/{grupo.itens.length}</p>
                  <p className="text-xs text-zinc-500">concluídos</p>
                </div>
                <button onClick={aoFechar} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
              </div>
            </header>

            <div className="space-y-5 p-5">
              {grupo.base.resumo && (
                <section>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Resumo da análise da IA</p>
                  <p className="text-sm leading-relaxed text-zinc-300">{grupo.base.resumo}</p>
                </section>
              )}
              <section>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Pedidos preparados ({grupo.itens.length}) — clique para conferir</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.itens.map((s) => <Pedido key={s.id} s={s} aoAbrir={() => aoAbrirPedido(s.id)} />)}
                </div>
              </section>
              {grupo.abertas === 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <span>Todos os pedidos desta tarefa foram concluídos. Falta dar andamento na tarefa no Lawyertool.</span>
                  <LinkTarefaLawyertool tarefaId={grupo.tarefaId} className="font-medium" />
                </div>
              )}
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                Preparada em {dataHora(grupo.maisRecente)}.
                <LinkTarefaLawyertool tarefaId={grupo.tarefaId} />
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

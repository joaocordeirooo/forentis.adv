'use client';

import { LayoutGroup, motion } from 'motion/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { normalizar } from '@/utils/texto.util';
import { cn } from '@/lib/utils';
import type { Solicitacao } from '@/models/solicitacao.model';
import { CartaoSolicitacao } from './cartao-solicitacao';
import { DetalheSolicitacao } from './detalhe-solicitacao';

const FILTROS: { chave: string; rotulo: string; teste: (s: Solicitacao) => boolean }[] = [
  { chave: 'abertas', rotulo: 'Para conferir', teste: (s) => ['aguardando_conferencia', 'falha_envio'].includes(s.status) },
  { chave: 'bloqueadas', rotulo: 'Bloqueadas', teste: (s) => s.status === 'bloqueada' },
  { chave: 'concluidas', rotulo: 'Concluídas', teste: (s) => s.status === 'concluida' },
  { chave: 'arquivadas', rotulo: 'Descartadas', teste: (s) => ['descartada', 'substituida'].includes(s.status) },
  { chave: 'todas', rotulo: 'Todas', teste: () => true },
];

export function FilaSolicitacoes() {
  const { dados, erro, carregando, recarregar } = useConsulta(api.solicitacoes, 30_000);
  const [filtro, setFiltro] = useState('abertas');
  const [tipo, setTipo] = useState<'todos' | 'cliente' | 'empresa'>('todos');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [limite, setLimite] = useState(30);

  const lista = dados ?? [];
  const visiveis = useMemo(() => {
    const teste = FILTROS.find((f) => f.chave === filtro)!.teste;
    const termo = normalizar(busca);
    return lista
      .filter(teste)
      .filter((s) => tipo === 'todos' || s.tipo === tipo)
      .filter((s) => !termo || normalizar(`${s.clienteNome} ${s.empresa} ${s.tarefaId}`).includes(termo));
  }, [lista, filtro, tipo, busca]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Solicitações</h1>
        <p className="mt-1 text-zinc-400">Confira, ajuste e conclua os pedidos preparados pela automação.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <LayoutGroup id="filtros">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/50 p-1">
            {FILTROS.map((f) => {
              const ativo = filtro === f.chave;
              const quantidade = lista.filter(f.teste).length;
              return (
                <button key={f.chave} onClick={() => setFiltro(f.chave)} className={cn('relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition', ativo ? 'text-white' : 'text-zinc-400 hover:text-zinc-200')}>
                  {ativo && <motion.span layoutId="filtro-ativo" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className="relative">{f.rotulo}</span>
                  <span className="relative rounded-md bg-white/10 px-1.5 text-xs tabular-nums">
                    {quantidade}
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <div className="flex gap-1 rounded-2xl border border-white/10 bg-zinc-900/50 p-1">
          {(['todos', 'cliente', 'empresa'] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)} className={cn('rounded-xl px-3 py-2 text-sm capitalize transition', tipo === t ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200')}>
              {t}
            </button>
          ))}
        </div>

        <div className="relative lg:ml-auto lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, empresa ou tarefa" className="w-full rounded-2xl border border-white/10 bg-zinc-900/50 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500" />
        </div>
      </div>

      <AvisoErro erro={erro} />

      {carregando ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Esqueleto key={i} className="h-40" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.slice(0, limite).map((s, i) => <CartaoSolicitacao key={s.id} solicitacao={s} indice={i % 30} aoAbrir={() => setAberta(s.id)} />)}
          {!visiveis.length && <div className="col-span-full grid h-40 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">Nenhuma solicitação neste filtro.</div>}
          {visiveis.length > limite && (
            <button onClick={() => setLimite(limite + 30)} className="col-span-full rounded-2xl border border-white/10 py-3 text-sm text-zinc-300 hover:bg-white/5">
              Mostrar mais ({visiveis.length - limite} restantes)
            </button>
          )}
        </div>
      )}

      <DetalheSolicitacao id={aberta} aoFechar={() => setAberta(null)} aoMudar={recarregar} />
    </div>
  );
}

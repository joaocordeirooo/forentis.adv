'use client';

import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api, type ExecucaoCompleta } from '@/lib/api-client';
import { AnaliseAoVivo } from './analise-ao-vivo';
import { CartaoSolicitacao } from './cartao-solicitacao';
import { DetalheSolicitacao } from './detalhe-solicitacao';
import { FluxoAnimado } from './fluxo-animado';


export function VisaoGeral() {
  const [aberta, setAberta] = useState<string | null>(null);
  // A lista de execuções é leve; o detalhe da última só é buscado de 3 em 3 s enquanto ela está rodando.
  const execucoes = useConsulta(api.execucoes, 15_000);
  const ultima = execucoes.dados?.[0] ?? null;
  const rodando = ultima?.status === 'em_andamento';
  const execucao = useConsulta<ExecucaoCompleta | null>(
    () => (ultima ? api.execucao(ultima.id) : Promise.resolve(null)),
    rodando ? 3_000 : null,
    `${ultima?.id}-${ultima?.status}`,
  );
  const solicitacoes = useConsulta(api.solicitacoes, rodando ? 10_000 : 30_000);
  const tarefas = useConsulta(() => api.tarefas(), null);

  const lista = solicitacoes.dados ?? [];
  const abertas = lista.filter((s) => ['aguardando_conferencia', 'bloqueada', 'falha_envio'].includes(s.status));
  const numeros = {
    tarefas: tarefas.dados?.total ?? null,
    analisadas: execucao.dados?.tarefasProcessadas ?? 0,
    cliente: abertas.filter((s) => s.tipo === 'cliente').length,
    empresa: abertas.filter((s) => s.tipo === 'empresa').length,
    conferencia: abertas.length,
    enviadas: lista.filter((s) => s.status === 'concluida').length,
    analisando: execucao.dados?.status === 'em_andamento',
  };

  return (
    <div className="space-y-8">
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="mb-2 text-sm font-medium text-violet-300">Estação · Solicitação de documentos</p>
        <h1 className="max-w-3xl bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-5xl">
          Do Lawyertool ao pedido pronto para enviar.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          A IA lê cada tarefa, prepara a mensagem ao cliente e o e-mail à empresa com os recortes. Nada sai sem a conferência de alguém da equipe.
        </p>
      </motion.section>

      <section className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-6">
        <FluxoAnimado numeros={numeros} />
      </section>

      <AvisoErro erro={execucoes.erro ?? solicitacoes.erro} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {execucoes.carregando ? <Esqueleto className="h-64" /> : <AnaliseAoVivo execucao={execucao.dados} aoIniciar={execucoes.recarregar} />}
        </div>
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Aguardando conferência</h2>
            <Link href="/documentos/solicitacoes" className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200">
              Ver todas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {solicitacoes.carregando ? (
            <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-36" />)}</div>
          ) : abertas.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {abertas.slice(0, 6).map((s, i) => <CartaoSolicitacao key={s.id} solicitacao={s} indice={i} aoAbrir={() => setAberta(s.id)} />)}
            </div>
          ) : (
            <div className="grid h-36 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">Nada aguardando conferência.</div>
          )}
        </div>
      </div>

      <DetalheSolicitacao id={aberta} aoFechar={() => setAberta(null)} aoMudar={solicitacoes.recarregar} />
    </div>
  );
}

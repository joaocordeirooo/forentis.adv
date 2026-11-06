'use client';

import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, FileStack, Truck, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ChatDex } from '@/components/dex/chat-dex';
import { Contador } from '@/components/ui/contador';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { relativo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { LinksRapidos } from './links-rapidos';

function saudacao() {
  const hora = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function Numero({ valor, rotulo, destaque }: { valor: number; rotulo: string; destaque?: string }) {
  return (
    <div>
      <p className={cn('text-2xl font-semibold tabular-nums', valor > 0 && destaque ? destaque : 'text-white')}>
        <Contador valor={valor} />
      </p>
      <p className="text-xs text-zinc-500">{rotulo}</p>
    </div>
  );
}

function CartaoEstacao({ href, titulo, icone: Icone, cor, children, rodape, indice }: { href: string; titulo: string; icone: LucideIcon; cor: string; children: ReactNode; rodape?: ReactNode; indice: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: indice * 0.08 }}>
      <Link href={href} className="group block h-full rounded-2xl border border-white/10 bg-zinc-900/80 p-5 transition-colors hover:border-white/20">
        <div className="mb-4 flex items-center gap-3">
          <span className={cn('grid h-9 w-9 place-items-center rounded-xl', cor)}>
            <Icone className="h-4 w-4" />
          </span>
          <h2 className="flex-1 font-medium text-zinc-100">{titulo}</h2>
          <ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300" />
        </div>
        <div className="grid grid-cols-3 gap-3">{children}</div>
        {rodape && <div className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">{rodape}</div>}
      </Link>
    </motion.div>
  );
}

export function Inicio() {
  const { dados, carregando } = useConsulta(api.inicio, 60_000);
  const [cabecalho, setCabecalho] = useState<{ saudacao: string; data: string } | null>(null);

  useEffect(() => {
    setCabecalho({
      saudacao: saudacao(),
      data: (() => {
        const d = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' });
        return d.charAt(0).toUpperCase() + d.slice(1);
      })(),
    });
  }, []);

  const doc = dados?.documentos;
  const at = dados?.atendimento;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-zinc-500">{cabecalho?.data ?? ' '}</p>
          <h1 className="bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
            {cabecalho?.saudacao ?? 'Olá'}! Aqui está o seu dia.
          </h1>
        </motion.div>

        {carregando ? (
          <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Esqueleto key={i} className="h-44" />)}</div>
        ) : (
          dados && (
            <div className="grid gap-4 md:grid-cols-2">
              <CartaoEstacao
                indice={0}
                href="/documentos/solicitacoes"
                titulo="Solicitação de documentos"
                icone={FileStack}
                cor="bg-violet-500/15 text-violet-300"
                rodape={
                  doc?.ultimaExecucao ? (
                    <span className="inline-flex items-center gap-1">
                      {doc.ultimaExecucao.status === 'falhou' && <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
                      Última análise {relativo(doc.ultimaExecucao.iniciadaEm)} · {doc.ultimaExecucao.naoTratadas} não tratada(s)
                    </span>
                  ) : (
                    'Nenhuma análise rodou ainda.'
                  )
                }
              >
                <Numero valor={doc?.aguardando ?? 0} rotulo="para conferir" destaque="text-violet-300" />
                <Numero valor={doc?.bloqueadas ?? 0} rotulo="bloqueadas" destaque="text-amber-300" />
                <Numero valor={doc?.enviadasHoje ?? 0} rotulo="enviadas hoje" />
              </CartaoEstacao>

              <CartaoEstacao
                indice={1}
                href="/atendimento"
                titulo="Atendimento externo"
                icone={Truck}
                cor="bg-emerald-500/15 text-emerald-300"
                rodape={`${at?.atendente ?? ''} · ${at?.iniciadas ?? 0} iniciada(s) na semana`}
              >
                <Numero valor={at?.hoje ?? 0} rotulo="para hoje" destaque="text-emerald-300" />
                <Numero valor={at?.atrasadas ?? 0} rotulo="atrasadas" destaque="text-rose-300" />
                <Numero valor={at?.pendentes ?? 0} rotulo="pendentes na semana" />
              </CartaoEstacao>
            </div>
          )
        )}

        <LinksRapidos />
      </div>

      <ChatDex className="h-[600px] xl:sticky xl:top-8 xl:h-[calc(100vh-4rem)]" />
    </div>
  );
}

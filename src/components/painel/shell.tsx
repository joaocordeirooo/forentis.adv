'use client';

import { AnimatePresence, motion } from 'motion/react';
import { FileStack, History, Home, KeyRound, LayoutDashboard, ListTodo, Map, Menu, Sparkles, Truck, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { FundoAurora } from '@/components/ui/fundo-aurora';
import { useConsulta } from '@/hooks/use-consulta';
import { api, lerChaveApi, salvarChaveApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface ItemMenu {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  exato?: boolean;
}

// Menu organizado por estação. Uma estação nova = um grupo novo aqui.
const ESTACOES: { titulo: string | null; cor: string; itens: ItemMenu[] }[] = [
  { titulo: null, cor: 'text-zinc-400', itens: [{ href: '/', rotulo: 'Início', icone: Home, exato: true }] },
  {
    titulo: 'Solicitação de documentos',
    cor: 'text-violet-300',
    itens: [
      { href: '/documentos', rotulo: 'Visão geral', icone: LayoutDashboard, exato: true },
      { href: '/documentos/solicitacoes', rotulo: 'Solicitações', icone: FileStack },
      { href: '/documentos/execucoes', rotulo: 'Execuções', icone: History },
      { href: '/documentos/tarefas', rotulo: 'Tarefas monitoradas', icone: ListTodo },
    ],
  },
  {
    titulo: 'Atendimento externo',
    cor: 'text-emerald-300',
    itens: [
      { href: '/atendimento', rotulo: 'Tarefas da semana', icone: Truck, exato: true },
      { href: '/atendimento/rota', rotulo: 'Rota e despesas', icone: Map },
    ],
  },
];

function ChaveApi() {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  return (
    <div className="relative">
      <button
        onClick={() => {
          setValor(lerChaveApi());
          setAberto(!aberto);
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
      >
        <KeyRound className="h-4 w-4" /> Chave da API
      </button>
      {aberto && (
        <div className="absolute bottom-11 left-0 z-50 w-64 rounded-xl border border-white/10 bg-zinc-900 p-4 shadow-2xl">
          <p className="mb-2 text-xs text-zinc-400">Valor do API_KEY do .env (deixe vazio se não usar).</p>
          <input type="password" value={valor} onChange={(e) => setValor(e.target.value)} className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <button
            onClick={() => {
              salvarChaveApi(valor);
              window.location.reload();
            }}
            className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Salvar
          </button>
        </div>
      )}
    </div>
  );
}

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();
  const { dados: saude } = useConsulta(api.saude, 60_000);
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={aoNavegar} className="mb-6 flex items-center gap-2 px-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 shadow-lg shadow-violet-500/30">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <span className="font-semibold tracking-tight">Forentis</span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {ESTACOES.map((estacao, i) => (
          <div key={i}>
            {estacao.titulo && <p className={cn('mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider', estacao.cor)}>{estacao.titulo}</p>}
            <ul className="space-y-0.5">
              {estacao.itens.map(({ href, rotulo, icone: Icone, exato }) => {
                const ativo = exato ? caminho === href : caminho.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={aoNavegar}
                      className={cn('relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', ativo ? 'text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}
                    >
                      {ativo && <motion.span layoutId="menu-ativo" className="absolute inset-0 rounded-lg bg-white/10 ring-1 ring-white/10" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                      <Icone className="relative h-4 w-4" />
                      <span className="relative">{rotulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/5 pt-4">
        {saude?.modoTeste && (
          <span className="mx-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Modo teste
          </span>
        )}
        <ChaveApi />
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const caminho = usePathname();
  useEffect(() => setMenuAberto(false), [caminho]);

  return (
    <div className="relative min-h-screen">
      <FundoAurora />

      {/* Computador: barra lateral fixa */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/5 bg-[#08080d] px-3 py-5 lg:block">
        <Navegacao />
      </aside>

      {/* Celular: barra superior + menu que abre por cima */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-[#07070b]/95 px-4 py-3 lg:hidden">
        <button onClick={() => setMenuAberto(true)} className="rounded-lg p-2 text-zinc-300 hover:bg-white/10" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold tracking-tight">Forentis</span>
      </header>
      <AnimatePresence>
        {menuAberto && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/70 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuAberto(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-[#08080d] px-3 py-5 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <button onClick={() => setMenuAberto(false)} className="absolute right-3 top-4 rounded-lg p-2 text-zinc-400 hover:bg-white/10" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
              <Navegacao aoNavegar={() => setMenuAberto(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}

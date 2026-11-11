'use client';

import { useState } from 'react';
import { FiltroTarefas } from '@/components/painel/filtro-tarefas';
import { ListaTarefas } from '@/components/painel/lista-tarefas';
import { cn } from '@/lib/utils';

type Aba = 'filtro' | 'monitoradas';
const CHAVE = 'forentis.abaTarefas';

// Tela de tarefas: filtro geral (qualquer setor/fluxo) e a lista das monitoradas pela automação.
export function TarefasAbas() {
  // Esta tela só roda no navegador (carregada com ssr: false), então pode ler o localStorage já no início.
  const [aba, setAba] = useState<Aba>(() => {
    try {
      return localStorage.getItem(CHAVE) === 'monitoradas' ? 'monitoradas' : 'filtro';
    } catch {
      return 'filtro';
    }
  });

  function trocar(nova: Aba) {
    setAba(nova);
    try {
      localStorage.setItem(CHAVE, nova);
    } catch {
      /* sem armazenamento */
    }
  }

  return (
    <div className="space-y-6">
      {aba === 'filtro' && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tarefas</h1>
          <p className="mt-1 text-zinc-400">Todas as tarefas do Lawyertool, filtradas por setor, fluxo, responsável, situação e datas.</p>
        </div>
      )}
      <div className="inline-flex rounded-xl border border-white/10 p-1">
        {([['filtro', 'Filtrar tarefas'], ['monitoradas', 'Monitoradas pela automação']] as const).map(([id, rotulo]) => (
          <button key={id} onClick={() => trocar(id)} className={cn('rounded-lg px-3 py-1.5 text-sm transition-colors', aba === id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200')}>
            {rotulo}
          </button>
        ))}
      </div>
      {aba === 'filtro' ? <FiltroTarefas /> : <ListaTarefas />}
    </div>
  );
}

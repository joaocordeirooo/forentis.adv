'use client';

import dynamic from 'next/dynamic';
import { Esqueleto } from '@/components/ui/esqueleto';

// A tela de tarefas lembra filtro e aba no navegador: carrega só no cliente para não divergir da versão do servidor.
export const TarefasCarregador = dynamic(() => import('./tarefas-abas').then((m) => m.TarefasAbas), {
  ssr: false,
  loading: () => <Esqueleto className="h-64" />,
});

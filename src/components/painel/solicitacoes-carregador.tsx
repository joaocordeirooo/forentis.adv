'use client';

import dynamic from 'next/dynamic';
import { Esqueleto } from '@/components/ui/esqueleto';

// A tela de solicitações lembra o filtro no navegador: carrega só no cliente para não divergir da versão do servidor.
export const SolicitacoesCarregador = dynamic(() => import('./fila-solicitacoes').then((m) => m.FilaSolicitacoes), {
  ssr: false,
  loading: () => <Esqueleto className="h-64" />,
});

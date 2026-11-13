'use client';

import dynamic from 'next/dynamic';
import { Esqueleto } from '@/components/ui/esqueleto';

// A visão geral lembra o filtro "Pedido por" no navegador: carrega só no cliente para não divergir da versão do servidor.
export const VisaoGeralCarregador = dynamic(() => import('./visao-geral').then((m) => m.VisaoGeral), {
  ssr: false,
  loading: () => <Esqueleto className="h-64" />,
});

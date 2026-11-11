'use client';

import dynamic from 'next/dynamic';
import { Esqueleto } from '@/components/ui/esqueleto';

// Lembra o seu nome no navegador: carrega só no cliente.
export const AgentesCarregador = dynamic(() => import('./painel-agentes').then((m) => m.PainelAgentes), {
  ssr: false,
  loading: () => <Esqueleto className="h-64" />,
});

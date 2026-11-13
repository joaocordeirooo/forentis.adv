'use client';

import dynamic from 'next/dynamic';
import { Esqueleto } from '@/components/ui/esqueleto';

// Usa o nome do funcionário guardado no navegador: carrega só no cliente.
export const EmailsCarregador = dynamic(() => import('./painel-emails').then((m) => m.PainelEmails), {
  ssr: false,
  loading: () => <Esqueleto className="h-64" />,
});

'use client';

import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef } from 'react';

// Número que "rola" até o valor (estilo "number ticker").
export function Contador({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const bruto = useMotionValue(0);
  const suave = useSpring(bruto, { damping: 40, stiffness: 120 });
  const visivel = useInView(ref, { once: true });

  useEffect(() => {
    if (visivel) bruto.set(valor);
  }, [bruto, valor, visivel]);

  useEffect(
    () =>
      suave.on('change', (v) => {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('pt-BR');
      }),
    [suave],
  );

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}

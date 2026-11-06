'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Busca dados e (opcionalmente) repete a busca de tempos em tempos.
// Com a aba do navegador escondida, não busca nada (economiza servidor e máquina).
export function useConsulta<T>(buscar: () => Promise<T>, intervaloMs: number | null = null, chave: unknown = null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<Error | null>(null);
  const [carregando, setCarregando] = useState(true);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const recarregar = useCallback(async () => {
    try {
      const resultado = await buscarRef.current();
      setDados(resultado);
      setErro(null);
    } catch (e) {
      setErro(e as Error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    if (!intervaloMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') recarregar();
    }, intervaloMs);
    const aoVoltar = () => document.visibilityState === 'visible' && recarregar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [recarregar, intervaloMs, chave]);

  return { dados, erro, carregando, recarregar };
}

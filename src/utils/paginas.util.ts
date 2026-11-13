// Converte entre lista de páginas e o texto "1-3, 5, 8-9".

export function paginasParaTexto(paginas: number[]): string {
  const ordenadas = [...new Set(paginas)].sort((a, b) => a - b);
  const faixas: string[] = [];
  for (let i = 0; i < ordenadas.length; i++) {
    const inicio = ordenadas[i];
    while (i + 1 < ordenadas.length && ordenadas[i + 1] === ordenadas[i] + 1) i++;
    faixas.push(inicio === ordenadas[i] ? String(inicio) : `${inicio}-${ordenadas[i]}`);
  }
  return faixas.join(', ');
}

// Devolve null se o texto tiver algo inválido; ignora páginas acima do total.
export function textoParaPaginas(texto: string, total: number): number[] | null {
  const paginas = new Set<number>();
  for (const parte of texto.split(/[,;\s]+/).filter(Boolean)) {
    const faixa = /^(\d+)(?:-(\d+))?$/.exec(parte);
    if (!faixa) return null;
    const de = Number(faixa[1]);
    const ate = faixa[2] ? Number(faixa[2]) : de;
    if (de < 1 || ate < de) return null;
    for (let p = de; p <= Math.min(ate, total); p++) paginas.add(p);
  }
  return [...paginas].sort((a, b) => a - b);
}

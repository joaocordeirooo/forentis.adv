// Funções de texto usadas em vários pontos (as mesmas dos nós Code do n8n).

// Minúsculas, sem acento, espaços simples.
export function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Igual a normalizar, mas troca tudo que não é letra ou número por espaço.
export function normalizarChave(valor: unknown): string {
  return normalizar(valor).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function umaLinha(valor: unknown): string {
  return String(valor ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function lista<T = unknown>(valor: unknown): T[] {
  return Array.isArray(valor) ? (valor as T[]) : [];
}

export function unicos<T>(valores: T[]): T[] {
  return [...new Set(valores)];
}

// Remove objetos repetidos comparando o conteúdo.
export function unicosPorConteudo<T>(valores: T[]): T[] {
  return [...new Map(valores.map((v) => [JSON.stringify(v), v])).values()];
}

export function adicionarUnico<T>(destino: T[], item: T): void {
  const chave = JSON.stringify(item);
  if (!destino.some((existente) => JSON.stringify(existente) === chave)) destino.push(item);
}

// Texto puro a partir do HTML do Lawyertool (movimentações e prazos vêm com <p>, &nbsp; etc.).
export function textoDeHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/<\/(p|div|li|br)\s*>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Período de uma pendência como texto. A IA às vezes devolve {inicio, fim} (AAAA-MM-DD) em vez de texto.
export function textoPeriodo(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'string') return valor.trim() || null;
  const br = (v: unknown) => {
    const t = String(v ?? '').trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : t;
  };
  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    const inicio = br(o.inicio ?? o.de ?? o.periodo_inicio);
    const fim = br(o.fim ?? o.ate ?? o.periodo_fim);
    if (inicio || fim) return `${inicio || '?'} a ${fim || 'atual'}`;
  }
  return String(valor);
}

// HTML do editor do Lawyertool em texto, mantendo as quebras de parágrafo e de linha.
export function textoComLinhasDeHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

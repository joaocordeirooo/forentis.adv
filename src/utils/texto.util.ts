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

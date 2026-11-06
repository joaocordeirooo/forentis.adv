// Lê o JSON devolvido pela IA, tolerando cercas de Markdown (```json ... ```).
export function lerJsonDaIa(texto: unknown): Record<string, unknown> {
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new Error('resposta vazia');
  }
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const resultado: unknown = JSON.parse(limpo);
  if (!resultado || typeof resultado !== 'object' || Array.isArray(resultado)) {
    throw new Error('a resposta não é um objeto JSON');
  }
  return resultado as Record<string, unknown>;
}

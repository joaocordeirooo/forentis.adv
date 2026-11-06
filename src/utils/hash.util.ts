// Hash curto e estável (djb2) — o mesmo do n8n, para as assinaturas continuarem compatíveis.
export function hash(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

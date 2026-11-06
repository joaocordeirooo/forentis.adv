// Deixa o número no formato 55 + DDD + número (12 ou 13 dígitos).
export function normalizarTelefone(valor: unknown): string | null {
  let d = String(valor ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d.startsWith('55') && (d.length === 12 || d.length === 13) ? d : null;
}

// Mesmo número com/sem o 9: 55 + DDD + 9 + 8 dígitos  <->  55 + DDD + 8 dígitos.
export function varianteNove(numero: string | null): string | null {
  if (!numero) return null;
  if (numero.length === 13 && numero[4] === '9') return numero.slice(0, 4) + numero.slice(5);
  if (numero.length === 12) return numero.slice(0, 4) + '9' + numero.slice(4);
  return null;
}

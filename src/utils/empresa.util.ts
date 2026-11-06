import { normalizarChave } from './texto.util';

// Palavras que não ajudam a identificar a empresa (forma societária etc.).
const IRRELEVANTES = new Set([
  'ltda', 'limitada', 'me', 'epp', 'eireli', 'sa', 's', 'a', 'cia', 'companhia', 'e', 'de', 'da', 'do', 'das', 'dos',
  'industria', 'comercio', 'servicos', 'ind', 'com', 'srl', 'mei', 'filial', 'matriz', 'em', 'recuperacao', 'judicial',
]);

// Nome reduzido ao "núcleo": "METALÚRGICA ALFA LTDA." → "metalurgica alfa".
export function nucleoEmpresa(nome: unknown): string {
  return normalizarChave(nome)
    .split(' ')
    .filter((p) => p && !IRRELEVANTES.has(p))
    .join(' ');
}

// Diz se dois nomes parecem ser da mesma empresa: núcleo igual, ou um contém o outro com ao menos 2 palavras.
export function mesmaEmpresa(a: unknown, b: unknown): boolean {
  const x = nucleoEmpresa(a);
  const y = nucleoEmpresa(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [menor, maior] = x.length <= y.length ? [x, y] : [y, x];
  return menor.split(' ').length >= 2 && ` ${maior} `.includes(` ${menor} `);
}

// Separa vários e-mails escritos no mesmo campo.
export function separarEmails(valor: unknown): string[] {
  return String(valor ?? '')
    .split(/[;,/\s]+/)
    .map((e) => e.trim().replace(/^mailto:/i, ''))
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

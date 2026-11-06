import { readFile } from 'node:fs/promises';
import path from 'node:path';

const cache = new Map<string, string>();

// Lê um prompt de src/prompts/<nome>.md (os textos são cópia fiel do workflow do n8n).
export async function carregarPrompt(nome: string): Promise<string> {
  const guardado = cache.get(nome);
  if (guardado) return guardado;
  const texto = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), 'src', 'prompts', `${nome}.md`), 'utf8');
  cache.set(nome, texto);
  return texto;
}

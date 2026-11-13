import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PASTA_ANEXOS_EMAIL } from '@/config/email.config';
import { config } from '@/config/env.config';

// Anexos recebidos por e-mail: .dados/emails-anexos/<pasta>/<arquivo>.
// O caminho guardado no registro é relativo à pasta de dados (ex.: "emails-anexos/abc/1-ppp.pdf").

const raiz = () => path.join(/*turbopackIgnore: true*/ process.cwd(), config.pastaDados);

function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '');
  return (limpo || 'anexo').slice(-120);
}

export async function guardarAnexoEmail(pasta: string, nome: string, conteudo: Buffer): Promise<string> {
  const relativo = path.posix.join(PASTA_ANEXOS_EMAIL, nomeSeguro(pasta), nomeSeguro(nome));
  const destino = path.join(raiz(), relativo);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, conteudo);
  return relativo;
}

export async function lerAnexoEmail(relativo: string): Promise<Buffer | null> {
  const base = path.join(raiz(), PASTA_ANEXOS_EMAIL);
  const caminho = path.resolve(raiz(), relativo);
  if (!caminho.startsWith(base + path.sep)) return null; // nunca sai da pasta de anexos
  try {
    return await readFile(caminho);
  } catch {
    return null;
  }
}

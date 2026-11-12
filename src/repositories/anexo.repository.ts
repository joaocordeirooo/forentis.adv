import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '@/config/env.config';

// Os PDFs recortados ficam em .dados/anexos/<id da solicitação>/<nome do arquivo>.
function pasta(solicitacaoId: string): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), config.pastaDados, 'anexos', solicitacaoId);
}

export async function gravarAnexo(solicitacaoId: string, nomeArquivo: string, conteudo: Buffer): Promise<void> {
  await mkdir(pasta(solicitacaoId), { recursive: true });
  await writeFile(path.join(pasta(solicitacaoId), path.basename(nomeArquivo)), conteudo);
}

export async function lerAnexo(solicitacaoId: string, nomeArquivo: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(pasta(solicitacaoId), path.basename(nomeArquivo)));
  } catch {
    return null;
  }
}

export async function apagarAnexo(solicitacaoId: string, nomeArquivo: string): Promise<void> {
  await rm(path.join(pasta(solicitacaoId), path.basename(nomeArquivo)), { force: true });
}

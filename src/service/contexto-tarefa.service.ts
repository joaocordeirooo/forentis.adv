import {
  baixarArquivo,
  listarArquivos,
  listarComentariosTarefa,
  listarMovimentacoes,
  obterProcesso,
} from '@/integrations/lawyertool.integration';
import { AppError } from '@/errors/app.errors';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import type { Tarefa } from '@/models/tarefa.model';

// Lê no Lawyertool tudo o que a análise precisa sobre a tarefa.
export async function coletarContexto(tarefa: Tarefa): Promise<ContextoTarefa> {
  if (!tarefa.processo?.id) {
    throw new AppError('Tarefa sem processo vinculado no Lawyertool.', 422);
  }

  const processo = await obterProcesso(tarefa.processo.id);
  if (!processo?.id || !processo.emitente?.id) {
    throw new AppError('Processo ou cliente não identificado na consulta ao Lawyertool.', 422);
  }

  const [movimentacoes, arquivos] = await Promise.all([
    listarMovimentacoes(processo.id),
    listarArquivos(processo.id, processo.emitente.id),
  ]);

  // Se a consulta de comentários falhar, a análise segue, mas nada é preparado
  // para o cliente (sem comentários não dá para saber se já houve contato).
  let comentarios: ContextoTarefa['comentarios'];
  try {
    const resposta = await listarComentariosTarefa(tarefa.id);
    comentarios = Array.isArray(resposta.data)
      ? { ok: true, data: resposta.data }
      : { ok: false, erro: 'resposta sem lista de comentários' };
  } catch (erro) {
    comentarios = { ok: false, erro: (erro as Error).message };
  }

  return { tarefa, processo, movimentacoes, arquivos, comentarios, downloads: new Map() };
}

// Baixa um arquivo uma única vez por tarefa.
export async function baixarComCache(contexto: ContextoTarefa, arquivoId: number): Promise<Buffer> {
  const guardado = contexto.downloads.get(arquivoId);
  if (guardado) return guardado;
  const conteudo = await baixarArquivo(arquivoId);
  contexto.downloads.set(arquivoId, conteudo);
  return conteudo;
}

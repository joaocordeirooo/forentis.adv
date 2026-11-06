import type { Arquivo, Comentario, Movimentacao, Processo, RespostaPaginada } from './lawyertool.model';
import type { Tarefa } from './tarefa.model';

// Tudo o que foi lido do Lawyertool sobre uma tarefa (equivale a consultaProcesso,
// consultarMovimentacoes, consultaArquivo e consultarComentariosTarefa do n8n).
export interface ContextoTarefa {
  tarefa: Tarefa;
  processo: Processo;
  movimentacoes: RespostaPaginada<Movimentacao>;
  arquivos: RespostaPaginada<Arquivo>;
  comentarios: { ok: true; data: Comentario[] } | { ok: false; erro: string };
  // PDFs já baixados nesta tarefa (para não baixar duas vezes).
  downloads: Map<number, Buffer>;
}

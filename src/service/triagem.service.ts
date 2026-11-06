import { config } from '@/config/env.config';
import { gerarJson } from '@/integrations/openai.integration';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import { hash } from '@/utils/hash.util';
import { carregarPrompt } from '@/utils/prompt.util';
import { ehComentarioAutomatico } from './travas.service';

const corta = (texto: unknown, limite: number) => {
  const t = String(texto ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > limite ? `${t.slice(0, limite)}…` : t;
};

// "Impressão digital" da tarefa: muda quando entra movimentação, comentário (não automático) ou arquivo novo.
export function impressaoDaTarefa(contexto: ContextoTarefa): string {
  const comentarios = contexto.comentarios.ok
    ? contexto.comentarios.data.filter((c) => !ehComentarioAutomatico(c.conteudo)).map((c) => [c.id, c.dataAlt ?? c.dataCad])
    : ['falhou'];
  return hash(
    JSON.stringify([
      contexto.tarefa.tipoTarefa?.id,
      contexto.tarefa.situacao,
      (contexto.movimentacoes.data ?? []).map((m) => m.id).sort(),
      comentarios,
      (contexto.arquivos.data ?? []).map((a) => a.id).sort(),
    ]),
  );
}

// Triagem rápida e barata: a tarefa tem pedido de documento/informação a cliente ou empresa?
export async function triarTarefa(contexto: ContextoTarefa): Promise<{ envolve: boolean; motivo: string }> {
  const { tarefa, movimentacoes, comentarios } = contexto;
  const entrada = {
    tarefa: { id: tarefa.id, titulo: tarefa.titulo, tipo: tarefa.tipoTarefa?.descricao },
    movimentacoes: (movimentacoes.data ?? []).slice(0, 25).map((m) => ({
      id: m.id,
      tipo: m.tipoMovimento?.descricao,
      status: m.status?.descricao,
      descricao: corta(m.descricao, 1200),
    })),
    comentarios: comentarios.ok
      ? comentarios.data.filter((c) => !ehComentarioAutomatico(c.conteudo)).slice(-20).map((c) => ({ id: c.id, data: c.dataCad, texto: corta(c.conteudo, 800) }))
      : 'consulta de comentários falhou',
  };

  const resposta = await gerarJson({
    modelo: config.openai.modeloAnalise,
    instrucoes: await carregarPrompt('triagem-tarefa'),
    texto: `${JSON.stringify(entrada)}\n\nResponda somente com o JSON.`,
  });
  if (typeof resposta.envolve_solicitacao_externa !== 'boolean') {
    throw new Error('triagem sem o campo envolve_solicitacao_externa');
  }
  return { envolve: resposta.envolve_solicitacao_externa, motivo: String(resposta.motivo ?? '') };
}

import { config } from '@/config/env.config';
import { gerarJson } from '@/integrations/openai.integration';
import type { AnaliseTarefa, DecisaoAnalise, Pendencia } from '@/models/analise.model';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import { carregarPrompt } from '@/utils/prompt.util';
import { lista } from '@/utils/texto.util';
import { ehComentarioAutomatico } from './travas.service';

const DECISOES: DecisaoAnalise[] = ['preparar_pendencias', 'consultar_arquivos', 'conferencia_humana', 'nenhuma_acao'];

// Monta a entrada da IA exatamente como o nó "AI Agent" do n8n.
function montarEntrada(contexto: ContextoTarefa): string {
  const { tarefa, processo, movimentacoes, arquivos, comentarios } = contexto;
  const listaComentarios = comentarios.ok ? comentarios.data : [];

  return JSON.stringify(
    {
      tarefa: {
        id: tarefa.id,
        titulo: tarefa.titulo,
        situacao: tarefa.situacao,
        tipo: tarefa.tipoTarefa?.descricao,
      },
      processo: {
        id: processo.id,
        cliente: { id: processo.emitente?.id, nome: processo.emitente?.nome },
        tipo: processo.tipoProcesso?.descricao,
        situacao: processo.situacaoPasta?.descricao,
        observacoes: processo.obs,
        alerta: processo.alerta,
      },
      comentarios_tarefa: {
        status_consulta: comentarios.ok ? 'ok' : `falhou: ${comentarios.erro}`,
        quantidade_recebida: listaComentarios.length,
        comentarios: listaComentarios
          .filter((c) => !ehComentarioAutomatico(c.conteudo))
          .map((c) => ({
            id: c.id,
            tarefa_id: c.tarefa?.id,
            conteudo: c.conteudo,
            criado_em: c.dataCad,
            alterado_em: c.dataAlt,
            autor: c.usuario?.nome,
          })),
        observacao_cobertura:
          'Comentários com marcadores conhecidos da automação foram excluídos. Outros comentários automáticos podem não ter sido identificados.',
      },
      movimentacoes: movimentacoes.data,
      arquivos: arquivos.data,
      cobertura_movimentacoes: { total: movimentacoes.total, paginas: movimentacoes.totalPages },
      cobertura_arquivos: { total: arquivos.total, paginas: arquivos.totalPages },
    },
    null,
    2,
  );
}

function vazia(decisao: DecisaoAnalise, motivo: string): AnaliseTarefa {
  return {
    decisao,
    motivo_nao_tratada: motivo,
    resumo: '',
    pendencias: [],
    arquivos_para_ler: [],
    duvidas: [],
    texto_cliente: '',
    confianca_cliente: null,
    pendencias_cliente: [],
    pendencias_empresa: [],
    pendencias_indefinidas: [],
  };
}

// Análise da tarefa (nós AI Agent + formatacao + separarPendencias).
export async function analisarTarefa(contexto: ContextoTarefa): Promise<AnaliseTarefa> {
  let resultado: Record<string, unknown>;
  try {
    resultado = await gerarJson({
      modelo: config.openai.modeloAnalise,
      instrucoes: await carregarPrompt('analise-tarefa'),
      texto: `${montarEntrada(contexto)}\n\nResponda somente com o JSON no formato definido.`,
    });
  } catch (erro) {
    return vazia('erro_analise', `Resposta da IA inválida: ${(erro as Error).message}`);
  }

  const decisao = resultado.decisao as DecisaoAnalise;
  if (!DECISOES.includes(decisao)) {
    return vazia('erro_analise', `Decisão da IA não reconhecida: ${String(resultado.decisao)}`);
  }

  const pendencias = lista<Pendencia>(resultado.pendencias);
  const tipo = (p: Pendencia) => String(p?.destinatario_tipo ?? '').trim().toLowerCase();
  const confianca = String(resultado.confianca_cliente ?? '').toLowerCase();

  return {
    decisao,
    resumo: String(resultado.resumo ?? ''),
    pendencias,
    arquivos_para_ler: lista(resultado.arquivos_para_ler),
    duvidas: lista<string>(resultado.duvidas),
    texto_cliente: String(resultado.texto_cliente ?? ''),
    confianca_cliente: ['alta', 'media', 'baixa'].includes(confianca) ? (confianca as AnaliseTarefa['confianca_cliente']) : null,
    pendencias_cliente: pendencias.filter((p) => tipo(p) === 'cliente'),
    pendencias_empresa: pendencias.filter((p) => tipo(p) === 'empresa'),
    pendencias_indefinidas: pendencias.filter((p) => !['cliente', 'empresa'].includes(tipo(p))),
  };
}

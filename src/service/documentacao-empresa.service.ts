import { config } from '@/config/env.config';
import { formatoAceitoPelaIa, gerarJson } from '@/integrations/openai.integration';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import type { AnalisesConsolidadas, ArquivoParaAnalisar, AvaliacaoEmpresa } from '@/models/empresa.model';
import { carregarPrompt } from '@/utils/prompt.util';
import { lista, normalizar, normalizarChave, unicosPorConteudo } from '@/utils/texto.util';
import { baixarComCache } from './contexto-tarefa.service';

const LIMITE_BYTES_IA = 30 * 1024 * 1024;

export interface LocalizacaoDocumentos {
  documentacao: Record<string, unknown>[];
  cobertura_documental: Record<string, unknown>;
  inconsistencias_documentais: Record<string, unknown>[];
  outros_arquivos: { id: number; nome: string | null }[];
  arquivos_para_analisar: ArquivoParaAnalisar[];
  tem_arquivos_candidatos: boolean;
  consulta_incompleta: boolean;
  mensagem_usuario: string | null;
}

// Escolhe, pelo nome, os anexos que podem conter CTPS, procuração etc. (nó localizarDocumentacao).
export function localizarDocumentacao(contexto: ContextoTarefa): LocalizacaoDocumentos {
  const arquivos = contexto.arquivos.data ?? [];
  const diretos: Record<'ctps' | 'procuracao', { id: number; nome: string | null }[]> = { ctps: [], procuracao: [] };
  const paraAnalisar = new Map<number, ArquivoParaAnalisar>();
  const outros: { id: number; nome: string | null }[] = [];
  const inconsistencias: Record<string, unknown>[] = [];
  let validos = 0;

  for (const arquivo of arquivos) {
    if (arquivo.id == null) continue;
    if (arquivo.processo?.id != null && String(arquivo.processo.id) !== String(contexto.processo.id)) {
      inconsistencias.push({ arquivo_id: arquivo.id, nome: arquivo.nomeArquivo, motivo: 'Arquivo vinculado a outro processo.' });
      continue;
    }
    validos++;

    const nome = normalizarChave(arquivo.nomeArquivo);
    const tipos: string[] = [];
    const motivos: string[] = [];
    const marcar = (tipo: string, motivo: string) => { tipos.push(tipo); motivos.push(motivo); };

    if (/\bctps\b|carteira.*trabalho/.test(nome)) marcar('ctps', 'Conferir titularidade e localizar páginas do vínculo.');
    if (/\bprocuracao\b|mandato/.test(nome)) marcar('procuracao', 'Conferir titularidade e conteúdo da procuração.');
    if (/\bcnis\b|extrato previdenciario/.test(nome)) marcar('cnis', 'Conferir empresa e período; verificar eventuais documentos agrupados.');
    if (/\bcalculo\b|\bcontagem\b|tempo.*contribuicao/.test(nome)) marcar('calculo', 'Conferir referências ao vínculo e eventuais documentos agrupados.');
    if (/\bprocesso adm\b|processo administrativo|processo inss|copia.*processo|integra.*processo|processo.*integral|\bpa\b/.test(nome)) {
      marcar('processo_administrativo', 'Procurar CTPS e procuração dentro do processo e identificar suas páginas.');
    }
    if (/\bdocumentos\b|\bdocumentacao\b|\banexos\b|\bdossie\b|digitalizacao|arquivo unico|pdf unificado/.test(nome)) {
      marcar('documentos_agrupados', 'Verificar se o arquivo contém CTPS, procuração ou outros anexos pertinentes.');
    }

    const referencia = { id: arquivo.id, nome: arquivo.nomeArquivo ?? null };
    if (!tipos.length) {
      outros.push(referencia);
      continue;
    }
    for (const tipo of ['ctps', 'procuracao'] as const) {
      if (tipos.includes(tipo) && !diretos[tipo].some((d) => d.id === arquivo.id)) diretos[tipo].push(referencia);
    }
    paraAnalisar.set(arquivo.id, { ...referencia, tipos_candidatos: [...new Set(tipos)], perguntas_analise: [...new Set(motivos)] });
  }

  const total = Number(contexto.arquivos.total);
  const paginas = Number(contexto.arquivos.totalPages);
  const incompleta = (Number.isFinite(paginas) && paginas > 1) || (Number.isFinite(total) && total > arquivos.length);
  const temCandidatos = paraAnalisar.size > 0;

  let mensagem: string | null = null;
  if (incompleta) {
    mensagem = 'A consulta de anexos está incompleta. É necessário carregar as páginas restantes antes de concluir a busca documental.';
  } else if (!temCandidatos) {
    mensagem = validos === 0
      ? 'Não foram encontrados anexos utilizáveis na consulta realizada ao sistema. Localize a CTPS referente ao vínculo e a procuração, ou informe onde estão disponíveis.'
      : 'Não foram identificados, pelos nomes dos anexos consultados, arquivos candidatos a CTPS, procuração, CNIS, cálculo ou processo administrativo. Localize a documentação ou indique qual arquivo contém esses documentos.';
  }

  return {
    documentacao: (['ctps', 'procuracao'] as const).map((tipo) => ({
      tipo,
      status: diretos[tipo].length ? 'candidatos_localizados' : temCandidatos ? 'buscar_em_outros_documentos' : 'nao_localizado_por_nome',
      arquivos: diretos[tipo],
      conteudo_conferido: false,
    })),
    cobertura_documental: {
      arquivos_retornados: arquivos.length,
      arquivos_do_contexto: validos,
      total_informado: contexto.arquivos.total ?? null,
      paginas_informadas: contexto.arquivos.totalPages ?? null,
      consulta_incompleta: incompleta,
    },
    inconsistencias_documentais: inconsistencias,
    outros_arquivos: outros,
    arquivos_para_analisar: [...paraAnalisar.values()],
    tem_arquivos_candidatos: temCandidatos,
    consulta_incompleta: incompleta,
    mensagem_usuario: mensagem,
  };
}

// Mensagem do usuário da leitura de cada PDF (mesmo texto do nó "Message a model").
async function montarPedidoLeitura(arquivo: ArquivoParaAnalisar, base: Record<string, unknown>, localizacao: LocalizacaoDocumentos) {
  const contextoSolicitacao = {
    tarefa_id: base.tarefa_id,
    processo_id: base.processo_id,
    empresaOriginal: base.empresaOriginal,
    empresa_busca: base.empresa_busca,
    periodos: base.periodos ?? [],
    pendencias: base.pendencias ?? [],
    orientacoes_registradas: base.orientacoes_registradas ?? [],
    identificacoes_cnpj: base.identificacoes_cnpj ?? [],
    duvidas_analise: base.duvidas_analise ?? [],
    preparacao_anexos: base.preparacao_anexos ?? {},
    arquivos_para_analisar: localizacao.arquivos_para_analisar.map((a) => ({ id: a.id, nome: a.nome, tipos_candidatos: a.tipos_candidatos })),
    outros_arquivos: localizacao.outros_arquivos,
    inconsistencias_documentais: localizacao.inconsistencias_documentais,
  };
  const modelo = await carregarPrompt('analise-pdf-usuario');
  const valores: Record<string, string> = {
    ID: String(arquivo.id),
    NOME: String(arquivo.nome ?? ''),
    TIPOS: JSON.stringify(arquivo.tipos_candidatos),
    PERGUNTAS: JSON.stringify(arquivo.perguntas_analise),
    TAREFA: String(base.tarefa_id),
    PROCESSO: String(base.processo_id),
    EMPRESA: String(base.empresaOriginal ?? ''),
    EMPRESA_NORMALIZADA: String(base.empresa_busca ?? ''),
    PERIODOS: JSON.stringify(base.periodos ?? []),
    CONTEXTO: JSON.stringify(contextoSolicitacao, null, 2),
  };
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, chave: string) => valores[chave] ?? '');
}

// Lê cada PDF candidato com a IA e consolida (nós Message a model + formataçãoSaida + consolidaAnalises).
export async function analisarDocumentos(
  contexto: ContextoTarefa,
  base: Record<string, unknown>,
  localizacao: LocalizacaoDocumentos,
): Promise<{ consolidado: AnalisesConsolidadas; naoLidos: string[] }> {
  const { maxArquivosAnalise } = config.automacao;
  const instrucoes = await carregarPrompt('analise-pdf');
  const analises: Record<string, unknown>[] = [];
  const falhas: AnalisesConsolidadas['arquivos_com_falha_na_analise'] = [];
  const selecionados = localizacao.arquivos_para_analisar.slice(0, maxArquivosAnalise);
  const naoLidos = localizacao.arquivos_para_analisar.slice(maxArquivosAnalise).map((a) => `${a.nome ?? a.id} (limite de ${maxArquivosAnalise} arquivos por empresa)`);

  for (const arquivo of selecionados) {
    try {
      const nome = String(arquivo.nome ?? `arquivo-${arquivo.id}.pdf`);
      if (!formatoAceitoPelaIa(nome)) throw new Error('formato não aceito pela IA (só PDF ou imagem)');
      const conteudo = await baixarComCache(contexto, arquivo.id);
      if (conteudo.length > LIMITE_BYTES_IA) throw new Error('arquivo maior que 30 MB');

      const analise = await gerarJson({
        modelo: config.openai.modeloPdf,
        instrucoes,
        texto: await montarPedidoLeitura(arquivo, base, localizacao),
        arquivo: { nome, conteudo },
      });
      if (!Array.isArray(analise.arquivos_analisados) || !Array.isArray(analise.documentos)) {
        throw new Error('estrutura da análise inválida');
      }
      analises.push(analise);
    } catch (erro) {
      falhas.push({ arquivo_id: arquivo.id, nome: arquivo.nome, erro: (erro as Error).message });
    }
  }

  const juntar = (campo: string) => unicosPorConteudo(analises.flatMap((a) => lista<Record<string, unknown>>(a[campo])));
  const arquivosAnalisados = juntar('arquivos_analisados');
  const idsAnalisados = new Set(arquivosAnalisados.filter((a) => a.arquivo_id != null).map((a) => String(a.arquivo_id)));

  const pendentes = new Map<string, Record<string, unknown> & { motivos: string[] }>();
  for (const arquivo of juntar('arquivos_pendentes')) {
    const id = arquivo.arquivo_id;
    if (id != null && idsAnalisados.has(String(id))) continue;
    const chave = id != null ? `id:${id}` : `nome:${normalizar(arquivo.nome)}`;
    if (!pendentes.has(chave)) pendentes.set(chave, { ...arquivo, motivos: [] });
    const registro = pendentes.get(chave)!;
    if (arquivo.motivo && !registro.motivos.includes(String(arquivo.motivo))) registro.motivos.push(String(arquivo.motivo));
  }

  return {
    naoLidos,
    consolidado: {
      arquivos_analisados: arquivosAnalisados,
      arquivos_com_falha_na_analise: falhas,
      arquivos_pendentes: [...pendentes.values()],
      documentos: juntar('documentos'),
      inconsistencias: juntar('inconsistencias'),
      sugestoes_recorte: juntar('paginas_sugeridas_para_recorte'),
      pendencias_indicadas_pelas_analises: unicosPorConteudo(
        analises.flatMap((a) => lista(a.pendencias_restantes).map((p) => (typeof p === 'string' ? { descricao: p } : (p as Record<string, unknown>)))),
      ),
      resumos_por_arquivo: analises.map((a) => ({
        arquivo_ids: lista<Record<string, unknown>>(a.arquivos_analisados).map((x) => x.arquivo_id),
        resumo: String(a.resumo ?? ''),
      })),
    },
  };
}

// Decide o que pedir à empresa com base nas leituras (nós avaliarPendencias + prepararSaida).
export async function avaliarPendencias(
  base: Record<string, unknown>,
  consolidado: AnalisesConsolidadas,
): Promise<AvaliacaoEmpresa> {
  try {
    const resultado = await gerarJson({
      modelo: config.openai.modeloAnalise,
      instrucoes: await carregarPrompt('avaliar-pendencias'),
      texto: [
        'CONTEXTO ORIGINAL DA EMPRESA E PENDÊNCIAS:',
        JSON.stringify(base),
        '',
        'ANÁLISES CONSOLIDADAS:',
        JSON.stringify({
          tarefa_id: base.tarefa_id,
          processo_id: base.processo_id,
          empresa_atual: base.empresaOriginal,
          arquivos_analisados: consolidado.arquivos_analisados,
          arquivos_pendentes: consolidado.arquivos_pendentes,
          documentos: consolidado.documentos,
          inconsistencias: consolidado.inconsistencias,
          arquivos_com_falha_na_analise: consolidado.arquivos_com_falha_na_analise,
          pendencias_indicadas_pelas_analises: consolidado.pendencias_indicadas_pelas_analises,
        }),
        '',
        'Responda somente com o JSON no formato definido.',
      ].join('\n'),
    });
    if (!resultado.decisao) throw new Error('decisão ausente');
    return {
      decisao: String(resultado.decisao),
      pendencias_avaliadas: lista(resultado.pendencias_avaliadas),
      confirmacoes_com_cliente: lista<string>(resultado.confirmacoes_com_cliente),
      documentos_para_preparar_solicitacao: lista(resultado.documentos_para_preparar_solicitacao),
      alertas: lista<string>(resultado.alertas),
      resumo: String(resultado.resumo ?? ''),
    };
  } catch (erro) {
    return {
      decisao: 'revisao_humana',
      pendencias_avaliadas: [],
      confirmacoes_com_cliente: [],
      documentos_para_preparar_solicitacao: [],
      alertas: [`Avaliação consolidada inválida: ${(erro as Error).message}`],
      resumo: '',
    };
  }
}

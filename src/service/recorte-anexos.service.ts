import { randomUUID } from 'node:crypto';
import { recortarPaginas } from '@/integrations/pdf.integration';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import type { AnalisesConsolidadas, RecortePlanejado } from '@/models/empresa.model';
import type { AnexoSolicitacao } from '@/models/solicitacao.model';
import { gravarAnexo } from '@/repositories/anexo.repository';
import { baixarComCache } from './contexto-tarefa.service';

export interface PendenciaRecorte {
  arquivo_id: unknown;
  tipo: unknown;
  motivo: string;
}

function validarPaginas(valor: unknown): number[] | null {
  if (!Array.isArray(valor) || !valor.length) return null;
  if (valor.some((p) => !Number.isInteger(p) || p < 1)) return null; // não converte valores inválidos
  return [...new Set(valor as number[])].sort((a, b) => a - b);
}

function nomeSeguro(valor: unknown): string {
  return (
    String(valor ?? 'documento')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 60) || 'documento'
  );
}

// Só aceita recortes confirmados por um documento "encontrado" com as mesmas páginas (nó validarPlanoAnexos).
export function planejarRecortes(processoId: number, consolidado: AnalisesConsolidadas) {
  const arquivos = consolidado.arquivos_analisados;
  const documentos = consolidado.documentos;
  const plano: RecortePlanejado[] = [];
  const pendencias: PendenciaRecorte[] = [];
  const vistos = new Set<string>();

  for (const sugestao of consolidado.sugestoes_recorte) {
    const rejeitar = (motivo: string) => pendencias.push({ arquivo_id: sugestao?.arquivo_id ?? null, tipo: sugestao?.tipo ?? null, motivo });

    if (!sugestao || typeof sugestao !== 'object') { rejeitar('Sugestão de recorte inválida.'); continue; }
    if (sugestao.arquivo_id == null) { rejeitar('Arquivo não informado.'); continue; }

    const arquivo = arquivos.find((a) => a.arquivo_id != null && String(a.arquivo_id) === String(sugestao.arquivo_id));
    if (!arquivo) { rejeitar('Arquivo não consta em arquivos_analisados.'); continue; }

    const paginas = validarPaginas(sugestao.paginas_pdf);
    if (!paginas) { rejeitar('As páginas devem ser uma lista de inteiros positivos.'); continue; }

    const total = arquivo.total_paginas_pdf;
    if (!Number.isInteger(total) || (total as number) < 1) { rejeitar('Quantidade de páginas do arquivo não confirmada.'); continue; }
    if (paginas.some((p) => p > (total as number))) { rejeitar(`Há páginas acima do total informado: ${total}.`); continue; }

    const tipo = String(sugestao.tipo ?? '').trim();
    if (!tipo) { rejeitar('Tipo do documento não informado.'); continue; }

    const correspondentes = documentos.filter((documento) => {
      if (String(documento.arquivo_id) !== String(sugestao.arquivo_id) || documento.tipo !== tipo || documento.status !== 'encontrado') return false;
      const paginasDocumento = validarPaginas(documento.paginas_documento);
      return paginasDocumento !== null && paginas.every((p) => paginasDocumento.includes(p));
    });
    if (correspondentes.length !== 1) {
      rejeitar(correspondentes.length === 0
        ? 'Não há documento encontrado que confirme o tipo e todas as páginas.'
        : 'Mais de um documento corresponde ao recorte; conferir seleção.');
      continue;
    }

    const chave = JSON.stringify([String(sugestao.arquivo_id), tipo, paginas]);
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const identificador = [nomeSeguro(processoId), nomeSeguro(sugestao.arquivo_id), nomeSeguro(tipo), paginas.join('-')].join('_');
    plano.push({
      anexoId: identificador,
      arquivoId: Number(sugestao.arquivo_id),
      arquivoNome: (arquivo.nome as string) ?? null,
      tipo,
      paginas,
      nomeArquivo: `${identificador}.pdf`,
      finalidade: String(sugestao.finalidade ?? ''),
    });
  }
  return { plano, pendencias };
}

// Gera os PDFs recortados e guarda na pasta de dados da solicitação.
export async function gerarAnexos(contexto: ContextoTarefa, solicitacaoId: string, plano: RecortePlanejado[]) {
  const anexos: AnexoSolicitacao[] = [];
  const falhas: PendenciaRecorte[] = [];

  for (const recorte of plano) {
    try {
      if (!/\.pdf$/i.test(recorte.arquivoNome ?? '')) throw new Error('o arquivo de origem não é PDF');
      const original = await baixarComCache(contexto, recorte.arquivoId);
      const conteudo = await recortarPaginas(original, recorte.paginas);
      await gravarAnexo(solicitacaoId, recorte.nomeArquivo, conteudo);
      anexos.push({
        id: randomUUID(),
        nomeArquivo: recorte.nomeArquivo,
        tipo: recorte.tipo,
        paginas: recorte.paginas,
        arquivoOrigemId: recorte.arquivoId,
        arquivoOrigemNome: recorte.arquivoNome,
        finalidade: recorte.finalidade,
        tamanhoBytes: conteudo.length,
        incluir: true,
      });
    } catch (erro) {
      falhas.push({ arquivo_id: recorte.arquivoId, tipo: recorte.tipo, motivo: `Recorte não gerado: ${(erro as Error).message}` });
    }
  }
  return { anexos, falhas };
}


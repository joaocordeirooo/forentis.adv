import { randomUUID } from 'node:crypto';
import { AppError } from '@/errors/app.errors';
import { baixarArquivo, listarArquivos, obterProcesso } from '@/integrations/lawyertool.integration';
import { contarPaginas, recortarPaginas } from '@/integrations/pdf.integration';
import type { AnexoSolicitacao, Solicitacao } from '@/models/solicitacao.model';
import { STATUS_ABERTOS } from '@/models/solicitacao.model';
import { apagarAnexo, gravarAnexo } from '@/repositories/anexo.repository';
import { atualizarSolicitacao, obterSolicitacao } from '@/repositories/solicitacao.repository';
import { normalizarChave } from '@/utils/texto.util';
import type { AnexarPaginas } from '@/validators/solicitacao.validator';

// O funcionário escolhe as páginas de um documento do processo (CTPS, procuração...) para o pedido à empresa.

export interface DocumentoProcesso {
  id: number;
  nome: string;
  tipo: string;
  rotulo: string;
  enviadoEm: string | null;
}

// Ordem em que os documentos aparecem para escolher (CTPS primeiro).
const TIPOS: { tipo: string; rotulo: string; regex: RegExp }[] = [
  { tipo: 'ctps', rotulo: 'CTPS', regex: /\bctps\b|carteira.*trabalho/ },
  { tipo: 'procuracao', rotulo: 'Procuração', regex: /\bprocuracao\b|\bmandato\b/ },
  { tipo: 'ppp', rotulo: 'PPP', regex: /\bppp\b|perfil profissiografico/ },
  { tipo: 'ficha_registro', rotulo: 'Ficha de registro', regex: /ficha.*registro|registro.*empregado|livro.*registro/ },
  { tipo: 'documento_pessoal', rotulo: 'Documento pessoal', regex: /\brg\b|\bcpf\b|\bcnh\b|identidade/ },
  { tipo: 'cnis', rotulo: 'CNIS', regex: /\bcnis\b/ },
];
export const ROTULO_OUTRO = 'Outros';

function classificar(nome: string) {
  const chave = normalizarChave(nome);
  const indice = TIPOS.findIndex((t) => t.regex.test(chave));
  return indice >= 0 ? { ...TIPOS[indice], ordem: indice } : { tipo: 'outro', rotulo: ROTULO_OUTRO, ordem: TIPOS.length };
}

// Pequeno cache: a lista de arquivos (5 min) e os PDFs baixados (10 min, poucos de cada vez).
const cacheLista = new Map<number, { em: number; documentos: DocumentoProcesso[] }>();
const cachePdf = new Map<number, { em: number; conteudo: Buffer; paginas: number }>();
const MAX_PDFS_CACHE = 8;

async function solicitacaoAberta(id: string): Promise<Solicitacao> {
  const s = await obterSolicitacao(id);
  if (!s) throw new AppError('Solicitação não encontrada.', 404);
  if (s.tipo !== 'empresa') throw new AppError('A escolha de páginas é para o pedido à empresa.', 400);
  return s;
}

export async function listarDocumentos(solicitacaoId: string, atualizar = false): Promise<DocumentoProcesso[]> {
  const s = await solicitacaoAberta(solicitacaoId);
  const guardado = cacheLista.get(s.processoId);
  if (!atualizar && guardado && Date.now() - guardado.em < 5 * 60_000) return guardado.documentos;

  const processo = await obterProcesso(s.processoId);
  if (!processo?.emitente?.id) throw new AppError('Cliente do processo não identificado no Lawyertool.', 422);
  const resposta = await listarArquivos(processo.id, processo.emitente.id);
  const documentos = (resposta.data ?? [])
    .filter((a) => a.id != null && /\.pdf$/i.test(String(a.nomeArquivo ?? '')))
    .map((a) => {
      const nome = String(a.nomeArquivo);
      const c = classificar(nome);
      return { documento: { id: a.id, nome, tipo: c.tipo, rotulo: c.rotulo, enviadoEm: typeof a.dataCad === 'string' ? a.dataCad : null }, ordem: c.ordem };
    })
    .sort((a, b) => a.ordem - b.ordem || a.documento.nome.localeCompare(b.documento.nome, 'pt-BR', { numeric: true }))
    .map((item) => item.documento);
  cacheLista.set(s.processoId, { em: Date.now(), documentos });
  return documentos;
}

// Baixa o PDF do Lawyertool, conferindo que é deste processo (não abre arquivo de outro cliente).
export async function obterDocumento(solicitacaoId: string, arquivoId: number) {
  const documentos = await listarDocumentos(solicitacaoId);
  let documento = documentos.find((d) => d.id === arquivoId);
  if (!documento) documento = (await listarDocumentos(solicitacaoId, true)).find((d) => d.id === arquivoId);
  if (!documento) throw new AppError('Este arquivo não é um PDF do processo desta solicitação.', 404);

  const guardado = cachePdf.get(arquivoId);
  if (guardado && Date.now() - guardado.em < 10 * 60_000) return { documento, ...guardado };

  const conteudo = await baixarArquivo(arquivoId);
  let paginas: number;
  try {
    paginas = await contarPaginas(conteudo);
  } catch (erro) {
    throw new AppError(`Não foi possível abrir o PDF ${documento.nome}: ${(erro as Error).message}`, 422);
  }
  cachePdf.set(arquivoId, { em: Date.now(), conteudo, paginas });
  while (cachePdf.size > MAX_PDFS_CACHE) cachePdf.delete(cachePdf.keys().next().value!);
  return { documento, conteudo, paginas };
}

const seguro = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'documento';

// Gera o PDF só com as páginas escolhidas e põe como anexo (ou troca um anexo existente).
export async function anexarPaginas(solicitacaoId: string, dados: AnexarPaginas): Promise<Solicitacao> {
  const s = await solicitacaoAberta(solicitacaoId);
  if (!STATUS_ABERTOS.includes(s.status)) throw new AppError(`A solicitação está "${s.status}" e não pode mais ser alterada.`, 409);
  const substituido = dados.substituirAnexoId ? s.anexos.find((a) => a.id === dados.substituirAnexoId) : null;
  if (dados.substituirAnexoId && !substituido) throw new AppError('Anexo a substituir não encontrado.', 404);

  const { documento, conteudo, paginas: total } = await obterDocumento(solicitacaoId, dados.arquivoId);
  const paginas = [...new Set(dados.paginas)].sort((a, b) => a - b);
  const fora = paginas.filter((p) => p > total);
  if (fora.length) throw new AppError(`O PDF tem ${total} página(s); fora do arquivo: ${fora.join(', ')}.`, 400);

  const recortado = await recortarPaginas(conteudo, paginas);
  const tipo = dados.tipo?.trim() || documento.tipo;
  const base = `${seguro(tipo)}_${dados.arquivoId}_p${paginas.length > 12 ? `${paginas[0]}-${paginas[paginas.length - 1]}` : paginas.join('-')}`;
  const usados = new Set(s.anexos.filter((a) => a.id !== substituido?.id).map((a) => a.nomeArquivo));
  let nomeArquivo = `${base}.pdf`;
  for (let n = 2; usados.has(nomeArquivo); n++) nomeArquivo = `${base}_${n}.pdf`;
  await gravarAnexo(solicitacaoId, nomeArquivo, recortado);

  const anexo: AnexoSolicitacao = {
    id: randomUUID(),
    nomeArquivo,
    tipo,
    paginas,
    arquivoOrigemId: dados.arquivoId,
    arquivoOrigemNome: documento.nome,
    finalidade: 'Páginas escolhidas na conferência',
    tamanhoBytes: recortado.length,
    incluir: true,
    origem: 'funcionario',
    mimeType: 'application/pdf',
    anexadoPor: dados.por,
  };
  if (substituido && substituido.nomeArquivo !== nomeArquivo) await apagarAnexo(solicitacaoId, substituido.nomeArquivo);

  const descricao = `${documento.nome} · págs. ${paginas.join(', ')}`;
  const atualizada = await atualizarSolicitacao(solicitacaoId, (atual) => ({
    ...atual,
    anexos: substituido ? atual.anexos.map((a) => (a.id === substituido.id ? anexo : a)) : [...atual.anexos, anexo],
    historico: [
      ...atual.historico,
      { em: new Date().toISOString(), evento: substituido ? 'paginas_ajustadas' : 'paginas_anexadas', por: dados.por, detalhe: substituido ? `${descricao} (antes: págs. ${substituido.paginas.join(', ')})` : descricao },
    ],
  }));
  return atualizada!;
}

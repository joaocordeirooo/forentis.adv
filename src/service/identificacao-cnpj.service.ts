import { config } from '@/config/env.config';
import { consultarCnpj } from '@/integrations/cnpja.integration';
import { gerarJson } from '@/integrations/openai.integration';
import { extrairTexto } from '@/integrations/pdf.integration';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import type { ContatoEncontrado, GrupoEmpresa } from '@/models/empresa.model';
import { buscarContatosPorEmpresa } from '@/repositories/contato-empresa.repository';
import { apenasDigitos, cnpjValido, extrairCnpjs } from '@/utils/cnpj.util';
import { dataPresenteNoTrecho } from '@/utils/data.util';
import { separarEmails } from '@/utils/empresa.util';
import { carregarPrompt } from '@/utils/prompt.util';
import { adicionarUnico, lista, normalizarChave, unicos } from '@/utils/texto.util';
import { baixarComCache } from './contexto-tarefa.service';

export interface IdentificacaoEmpresa {
  contatos: ContatoEncontrado[];
  cnpj: string | null;
  cadastro: Record<string, unknown> | null;
  identificacoes: Record<string, unknown>[];
  motivosBloqueio: string[];
  duvidas: string[];
  alertas: string[];
}

interface Tentativa {
  cnpj: string | null;
  podeConsultar: boolean;
  motivos: string[];
  alertas: string[];
  duvidas: string[];
  vinculo: Record<string, unknown> | null;
}

// Mesmas regras do nó selecionarDocsCNPJ.
const REGRAS = [
  { tipo: 'cnis', regex: /\bcnis\b/ },
  { tipo: 'ctps', regex: /\bctps\b|carteira.*trabalho/ },
  { tipo: 'ppp', regex: /\bppp\b|perfil profissiografico/ },
  { tipo: 'ficha_registro', regex: /ficha.*registro|registro.*empregado|livro.*registro/ },
  { tipo: 'procuracao', regex: /\bprocuracao\b|\bmandato\b/ },
  {
    tipo: 'documentos_agrupados',
    regex:
      /\bcp\s*\d{4}\b|processo administrativo|processo adm\b|processo inss|copia.*processo|integra.*processo|processo.*integral|\bpa\b|\bdocumentos\b|\bdocumentacao\b|\banexos\b|\bdossie\b|digitalizacao|arquivo unico|pdf unificado/,
  },
];

function selecionarDocumentosCnpj(contexto: ContextoTarefa) {
  const candidatos: { id: number; nome: string; prioridade: number }[] = [];
  const vistos = new Set<number>();
  for (const arquivo of contexto.arquivos.data ?? []) {
    if (arquivo.id == null || vistos.has(arquivo.id)) continue;
    const nome = String(arquivo.nomeArquivo ?? '').trim();
    if (!/\.pdf$/i.test(nome)) continue; // este caminho lê só PDFs
    const indice = REGRAS.findIndex((regra) => regra.regex.test(normalizarChave(nome)));
    if (indice < 0) continue;
    vistos.add(arquivo.id);
    candidatos.push({ id: arquivo.id, nome, prioridade: indice });
  }
  return candidatos.sort((a, b) => a.prioridade - b.prioridade);
}

// Confere o que a IA disse contra o próprio texto (nó validarCNPJ).
function validarResposta(resultado: Record<string, unknown>, contexto: ContextoTarefa, grupo: GrupoEmpresa): Tentativa[] {
  const vinculos = lista<Record<string, unknown>>(resultado.vinculos);
  const duvidas = lista<string>(resultado.duvidas);
  const motivosContexto: string[] = [];
  const empresaAlvo = normalizarChave(grupo.empresa);

  if (!empresaAlvo) motivosContexto.push('Empresa da solicitação não identificada.');
  for (const [campo, valor] of [['tarefa_id', contexto.tarefa.id], ['processo_id', contexto.processo.id]] as const) {
    if (resultado[campo] != null && String(resultado[campo]) !== String(valor)) {
      motivosContexto.push(`${campo} da análise diverge do contexto do fluxo.`);
    }
  }
  if (normalizarChave(resultado.empresa_atual) && empresaAlvo && normalizarChave(resultado.empresa_atual) !== empresaAlvo) {
    motivosContexto.push('Empresa atual da análise diverge da empresa da solicitação.');
  }

  if (!vinculos.length) {
    return [{ cnpj: null, podeConsultar: false, motivos: unicos([...motivosContexto, 'Nenhum vínculo correspondente identificado.']), alertas: [], duvidas, vinculo: null }];
  }

  return vinculos.map((vinculo) => {
    const motivos = [...motivosContexto];
    const alertas: string[] = [];
    const doOriginal = unicos(extrairCnpjs(vinculo.identificador_original));
    const doCampo = unicos(extrairCnpjs(vinculo.cnpj));
    const cnpj = doOriginal.length === 1 ? doOriginal[0] : doCampo.length === 1 ? doCampo[0] : '';
    const trecho = String(vinculo.trecho_fonte ?? '').replace(/\s+/g, ' ').trim();
    const empresa = normalizarChave(vinculo.empresa_documento);
    const cnpjsTrecho = unicos(extrairCnpjs(trecho));

    if (resultado.status !== 'encontrado') motivos.push('Identificação geral não conclusiva.');
    if (vinculo.status_identificador !== 'completo') motivos.push('Vínculo sem identificador classificado como completo.');
    if (!empresa) motivos.push('Empresa do vínculo não informada.');
    else if (empresaAlvo && empresa !== empresaAlvo) motivos.push('Correspondência entre empresa da solicitação e vínculo não confirmada.');
    if (!/^\d{14}$/.test(cnpj)) motivos.push('CNPJ incompleto ou ausente.');
    else if (!cnpjValido(cnpj)) motivos.push('CNPJ com dígitos verificadores inválidos.');
    if (doOriginal.length > 1 || doCampo.length > 1) motivos.push('Mais de um CNPJ nos campos de identificação.');
    if (doOriginal.length === 1 && doCampo.length === 1 && doOriginal[0] !== doCampo[0]) motivos.push('CNPJ diverge do identificador original.');
    if (!trecho) motivos.push('Trecho fonte ausente.');
    else {
      if (!cnpjsTrecho.includes(cnpj)) motivos.push('CNPJ não aparece no trecho informado.');
      if (cnpjsTrecho.length > 1) motivos.push('Trecho contém mais de um CNPJ.');
      if (!empresa || !` ${normalizarChave(trecho)} `.includes(` ${empresa} `)) motivos.push('Empresa não aparece no trecho informado.');
    }
    // Datas fora do trecho viram alerta: não impedem buscar o contato pelo CNPJ.
    for (const campo of ['periodo_inicio', 'periodo_fim']) {
      if (!dataPresenteNoTrecho(vinculo[campo], trecho)) alertas.push(`${campo} ausente, inválido ou não confirmado na precisão informada.`);
    }

    const bloqueios = unicos(motivos);
    return { cnpj: bloqueios.length ? null : cnpj, podeConsultar: bloqueios.length === 0, motivos: bloqueios, alertas, duvidas, vinculo };
  });
}

function registrarContato(destino: ContatoEncontrado[], contato: ContatoEncontrado) {
  if (contato.valor.trim()) adicionarUnico(destino, { ...contato, valor: contato.valor.trim() });
}

// Etapa A da empresa: contato na tabela interna; sem contato, procura o CNPJ nos PDFs e consulta a CNPJa.
export async function identificarEmpresa(contexto: ContextoTarefa, grupo: GrupoEmpresa): Promise<IdentificacaoEmpresa> {
  const saida: IdentificacaoEmpresa = { contatos: [], cnpj: null, cadastro: null, identificacoes: [], motivosBloqueio: [], duvidas: [], alertas: [] };

  const cadastrados = await buscarContatosPorEmpresa(grupo.empresa);
  for (const contato of cadastrados.contatos) {
    const base = { origem: 'tabela_interna' as const, empresa_origem: contato.empresa, cnpj_origem: contato.cnpj };
    for (const email of separarEmails(contato.email)) registrarContato(saida.contatos, { tipo: 'email', valor: email, ...base });
    if (contato.telefone) registrarContato(saida.contatos, { tipo: 'telefone', valor: contato.telefone, ...base });
  }
  if (cadastrados.ambiguos.length) {
    saida.alertas.push(`Vários cadastros internos parecidos com o nome (${cadastrados.ambiguos.join(' / ')}): nenhum foi usado; conferir manualmente.`);
  }
  if (cadastrados.contatos.length && !cadastrados.exato) {
    saida.alertas.push(`Contato encontrado por nome parecido (${[...new Set(cadastrados.contatos.map((c) => c.empresa))].join(' / ')}): conferir se é a mesma empresa.`);
  }
  if (cadastrados.contatos.length > 1) {
    const extras = cadastrados.contatos.map((c) => [c.contatoNome, c.cidade, c.observacao].filter(Boolean).join(' · ')).filter(Boolean);
    if (extras.length) saida.alertas.push(`Observações do cadastro interno: ${[...new Set(extras)].join(' | ')}`);
  } else if (cadastrados.contatos[0]) {
    const c = cadastrados.contatos[0];
    const extra = [c.contatoNome && `falar com ${c.contatoNome}`, c.cidade, c.observacao].filter(Boolean).join(' · ');
    if (extra) saida.alertas.push(`Cadastro interno: ${extra}`);
  }
  if (saida.contatos.length) return saida; // já tem contato cadastrado: não precisa do CNPJ

  const candidatos = selecionarDocumentosCnpj(contexto);
  if (!candidatos.length) {
    saida.alertas.push('Nenhum PDF candidato (CNIS, CTPS, PPP...) para identificar o CNPJ da empresa.');
    return saida;
  }

  const { maxArquivosCnpj } = config.automacao;
  if (candidatos.length > maxArquivosCnpj) {
    saida.alertas.push(`Só os ${maxArquivosCnpj} primeiros de ${candidatos.length} PDFs candidatos foram lidos para achar o CNPJ.`);
  }

  const instrucoes = await carregarPrompt('identificar-cnpj');
  const tentativas: Tentativa[] = [];

  for (const arquivo of candidatos.slice(0, maxArquivosCnpj)) {
    try {
      const { paginas, texto } = await extrairTexto(await baixarComCache(contexto, arquivo.id));
      if (!texto.trim()) {
        tentativas.push({ cnpj: null, podeConsultar: false, motivos: [`${arquivo.nome}: PDF sem texto (provavelmente escaneado).`], alertas: [], duvidas: [], vinculo: null });
        continue;
      }
      const resultado = await gerarJson({
        modelo: config.openai.modeloCnpj,
        instrucoes,
        texto: JSON.stringify({
          tarefa_id: contexto.tarefa.id,
          processo_id: contexto.processo.id,
          empresa_atual: grupo.empresa,
          destinatario_solicitacao: grupo.empresa,
          pendencias: grupo.pendencias,
          arquivo_id: arquivo.id,
          total_paginas_informado: paginas,
          texto_documento: texto.slice(0, 400_000),
        }),
      });
      tentativas.push(...validarResposta(resultado, contexto, grupo));
    } catch (erro) {
      tentativas.push({ cnpj: null, podeConsultar: false, motivos: [`${arquivo.nome}: ${(erro as Error).message}`], alertas: [], duvidas: [], vinculo: null });
    }
  }

  // Junta as tentativas (nó escolherCNPJ): só segue se houver exatamente um CNPJ válido.
  const validos = tentativas.filter((t) => t.podeConsultar && t.cnpj);
  const cnpjs = unicos(validos.map((t) => t.cnpj as string));
  saida.identificacoes = tentativas.map((t) => t.vinculo).filter((v): v is Record<string, unknown> => Boolean(v));
  saida.duvidas = unicos(tentativas.flatMap((t) => t.duvidas));
  saida.alertas.push(...unicos(tentativas.flatMap((t) => t.alertas)));

  if (cnpjs.length !== 1) {
    saida.motivosBloqueio = unicos(tentativas.flatMap((t) => t.motivos));
    if (cnpjs.length > 1) saida.motivosBloqueio.push(`Mais de um CNPJ válido para a mesma empresa (${cnpjs.join(', ')}); conferir manualmente.`);
    return saida;
  }

  saida.cnpj = cnpjs[0];
  try {
    const cadastro = await consultarCnpj(saida.cnpj);
    if (apenasDigitos(cadastro.taxId) !== saida.cnpj) throw new Error('O CNPJ retornado pela CNPJa não corresponde ao consultado.');
    saida.cadastro = {
      cnpj: cadastro.taxId,
      empresa: cadastro.company?.name,
      situacao_cadastral: cadastro.status?.text,
      cidade: cadastro.address?.city,
      uf: cadastro.address?.state,
      atualizado_em: cadastro.updated,
    };
    const base = { origem: 'CNPJa' as const, empresa_origem: cadastro.company?.name ?? null, cnpj_origem: cadastro.taxId ?? null };
    for (const email of cadastro.emails ?? []) registrarContato(saida.contatos, { tipo: 'email', valor: email.address ?? '', ...base });
    for (const fone of cadastro.phones ?? []) registrarContato(saida.contatos, { tipo: 'telefone', valor: `${fone.area ?? ''}${fone.number ?? ''}`, ...base });
    if (cadastro.status?.text && !/ativa/i.test(cadastro.status.text)) {
      saida.alertas.push(`Situação cadastral da empresa na Receita: ${cadastro.status.text}.`);
    }
  } catch (erro) {
    saida.motivosBloqueio.push(`Falha na consulta à CNPJa: ${(erro as Error).message}`);
  }
  return saida;
}

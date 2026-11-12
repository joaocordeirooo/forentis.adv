import { randomUUID } from 'node:crypto';
import { origemDaTarefa } from '@/utils/origem-tarefa.util';
import { config } from '@/config/env.config';
import type { AnaliseTarefa, Pendencia } from '@/models/analise.model';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import type { AvaliacaoEmpresa, GrupoEmpresa } from '@/models/empresa.model';
import type { AnexoSolicitacao, Solicitacao } from '@/models/solicitacao.model';
import { atualizarSolicitacao, buscarAberta, salvarSolicitacao } from '@/repositories/solicitacao.repository';
import { adicionarUnico, normalizarChave } from '@/utils/texto.util';
import { analisarDocumentos, avaliarPendencias, localizarDocumentacao } from './documentacao-empresa.service';
import { identificarEmpresa } from './identificacao-cnpj.service';
import { gerarAnexos, planejarRecortes } from './recorte-anexos.service';
import type { ResultadoPreparacao } from './solicitacao-cliente.service';
import { assinaturaEmpresa, chaveEmpresa, travasEmpresa } from './travas.service';

export const MARCA_COMPLETAR = 'a completar na conferência';

export interface ResultadoEmpresa extends ResultadoPreparacao {
  empresa: string;
}

// Uma iteração por empresa, só com o que há para pedir ou confirmar (nó agruparEmpresas).
export function agruparEmpresas(pendencias: Pendencia[]) {
  const grupos = new Map<string, GrupoEmpresa>();
  for (const pendencia of pendencias) {
    const empresa = String(pendencia.destinatario_nome ?? '').trim();
    const chave = normalizarChave(empresa) || '__sem_nome__';
    if (!grupos.has(chave)) grupos.set(chave, { empresa, empresaChave: normalizarChave(empresa), identificada: Boolean(empresa), pendencias: [] });
    grupos.get(chave)!.pendencias.push(pendencia);
  }
  const ativos: GrupoEmpresa[] = [];
  const acompanhamento: { empresa: string; pendencias: Pendencia[] }[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.pendencias.some((p) => ['solicitar', 'a_confirmar'].includes(String(p.situacao)))) ativos.push(grupo);
    else acompanhamento.push({ empresa: grupo.empresa || 'empresa não identificada', pendencias: grupo.pendencias });
  }
  return { ativos, acompanhamento };
}

export function textoPedido(cliente: string | null, pedidos: { documento: string; periodo: string | null; orientacoes?: string | null }[]): string {
  if (!pedidos.length) return '';
  const itens = pedidos.map((p) => {
    const ehPpp = /\bPPP\b|perfil profissiogr[aá]fico/i.test(p.documento);
    const documento = ehPpp
      ? 'Perfil Profissiográfico Previdenciário (PPP), com descrição das atividades efetivamente exercidas e das condições de trabalho'
      : p.documento.trim() || 'Documento a confirmar';
    return [`- ${documento}.`, `  Período: ${p.periodo ?? 'a confirmar'}.`, ...(p.orientacoes ? [`  ${p.orientacoes}`] : [])].join('\n');
  });
  return [
    'Prezados,',
    '',
    `Na qualidade de procuradores de ${cliente ?? '[nome do cliente]'}, solicitamos o fornecimento dos seguintes documentos:`,
    '',
    ...itens,
    '',
    `[Identificação do cliente (CPF, data de admissão) ${MARCA_COMPLETAR}.]`,
    '',
    'Seguem anexas a procuração e as páginas pertinentes da CTPS.',
    '',
    'Atenciosamente,',
    'Darcísio Müller Advogados Associados',
  ].join('\n');
}

// Prepara a solicitação a uma empresa: contato/CNPJ → documentos → avaliação → recortes.
export async function prepararSolicitacaoEmpresa(
  contexto: ContextoTarefa,
  analise: AnaliseTarefa,
  grupo: GrupoEmpresa,
  execucaoId: string,
): Promise<ResultadoEmpresa> {
  const cfg = config.automacao;
  const nomeEmpresa = grupo.empresa || 'Empresa não identificada';
  const chave = chaveEmpresa(nomeEmpresa);
  const assinatura = assinaturaEmpresa(chave, grupo.pendencias);
  const resultado = (dados: Partial<ResultadoEmpresa>): ResultadoEmpresa => ({
    empresa: nomeEmpresa, tratada: false, motivo: null, observacao: null, solicitacaoId: null, ...dados,
  });

  // Travas: comentários da tarefa e solicitação já aberta.
  if (!contexto.comentarios.ok) {
    return resultado({ motivo: 'Consulta de comentários falhou; nada preparado para evitar duplicidade.' });
  }
  const travas = travasEmpresa(contexto.comentarios.data, assinatura, chave, cfg.diasSemRepetir);
  if (travas.mesmaAssinatura || travas.tratadaRecentemente) {
    return resultado({ tratada: true, observacao: 'Pedido equivalente a esta empresa já registrado na tarefa recentemente.' });
  }
  const aberta = await buscarAberta(contexto.tarefa.id, 'empresa', chave);
  if (aberta && aberta.assinatura === assinatura) {
    return resultado({ tratada: true, observacao: `Solicitação já aguardando conferência (${aberta.id}).`, solicitacaoId: aberta.id });
  }

  // A — contato e CNPJ.
  const identificacao = await identificarEmpresa(contexto, grupo);

  // Base equivalente ao montarSolicitacao do n8n (é o "contexto original" da avaliação).
  const periodos: string[] = [];
  const orientacoes: Record<string, unknown>[] = [];
  for (const p of grupo.pendencias) {
    if (p.periodo) adicionarUnico(periodos, p.periodo);
    for (const fonte of p.fontes ?? []) {
      if (fonte.trecho) adicionarUnico(orientacoes, { documento: p.documento, fonte_tipo: fonte.tipo, fonte_id: fonte.id, trecho: fonte.trecho });
    }
  }
  const base: Record<string, unknown> = {
    tarefa_id: contexto.tarefa.id,
    processo_id: contexto.processo.id,
    tarefa_titulo: contexto.tarefa.titulo,
    cliente_nome: contexto.processo.emitente?.nome ?? null,
    empresa_identificada: grupo.identificada,
    empresaOriginal: nomeEmpresa,
    empresa_busca: grupo.empresaChave,
    resumo_analise_original: analise.resumo,
    pendencias: grupo.pendencias,
    periodos,
    orientacoes_registradas: orientacoes,
    duvidas_analise: analise.duvidas,
    duvidas_identificacao: identificacao.duvidas,
    identificacoes_cnpj: identificacao.identificacoes,
    cadastros_consultados: identificacao.cadastro ? [identificacao.cadastro] : [],
    contatos: identificacao.contatos,
    motivos_bloqueio: identificacao.motivosBloqueio,
  };

  // B — localizar, ler os documentos e avaliar.
  const localizacao = localizarDocumentacao(contexto);
  Object.assign(base, {
    documentacao: localizacao.documentacao,
    cobertura_documental: localizacao.cobertura_documental,
    inconsistencias_documentais: localizacao.inconsistencias_documentais,
    preparacao_anexos: {
      status: 'aguardando_verificacao_documental',
      empresa: nomeEmpresa,
      periodos,
      instrucoes: [
        'Confirmar a titularidade dos documentos.',
        'Localizar na CTPS as páginas do vínculo com a empresa.',
        'Selecionar as páginas de identificação pertinentes.',
        'Gerar o recorte em um novo arquivo, preservando o original.',
        'Localizar e conferir a procuração.',
        'Preparar o pacote com o recorte da CTPS e a procuração.',
      ],
    },
  });

  const bloqueios: string[] = [];
  const avisos: string[] = [...identificacao.alertas];
  let avaliacao: AvaliacaoEmpresa | null = null;
  let consolidado = null;
  let naoLidos: string[] = [];

  if (localizacao.tem_arquivos_candidatos && !localizacao.consulta_incompleta) {
    ({ consolidado, naoLidos } = await analisarDocumentos(contexto, base, localizacao));
    avaliacao = await avaliarPendencias(base, consolidado);
  } else {
    bloqueios.push(`Documentos não analisados: ${localizacao.mensagem_usuario}`);
  }

  if (avaliacao?.decisao === 'sem_pendencias') {
    return resultado({ tratada: true, observacao: `${nomeEmpresa}: todos os objetivos documentais já atendidos. ${avaliacao.alertas.join(' ')}`.trim() });
  }
  if (avaliacao?.decisao === 'revisao_humana') bloqueios.push(`Revisão humana: ${avaliacao.alertas[0] ?? 'a avaliação encaminhou para revisão humana.'}`);
  if (avaliacao?.decisao === 'aguardar_confirmacao_cliente') {
    bloqueios.push(`Aguardando confirmação do cliente: ${avaliacao.confirmacoes_com_cliente.join('; ') || 'ver detalhes'}.`);
  }
  if (!grupo.identificada) bloqueios.push('A análise não identificou o nome da empresa destinatária.');
  for (const motivo of identificacao.motivosBloqueio) avisos.push(`Identificação do CNPJ: ${motivo}`);
  for (const falha of consolidado?.arquivos_com_falha_na_analise ?? []) avisos.push(`A IA não conseguiu ler ${falha.nome ?? falha.arquivo_id}: ${falha.erro}`);
  for (const arquivo of naoLidos) avisos.push(`Arquivo não lido: ${arquivo}`);
  for (const alerta of avaliacao?.alertas ?? []) avisos.push(alerta);

  // Pedidos: os da avaliação; sem avaliação, os pedidos originais da análise.
  const pedidos = avaliacao?.documentos_para_preparar_solicitacao?.length
    ? avaliacao.documentos_para_preparar_solicitacao.map((p) => ({ documento: String(p.documento ?? ''), periodo: p.periodo ?? null, orientacoes: p.orientacoes ?? null }))
    : grupo.pendencias.filter((p) => p.situacao === 'solicitar').map((p) => ({ documento: p.documento, periodo: p.periodo, orientacoes: null }));
  if (!pedidos.length) bloqueios.push('Nenhum documento pronto para pedir à empresa.');

  const id = randomUUID();

  // C — recortes da CTPS/procuração.
  let anexos: AnexoSolicitacao[] = [];
  if (consolidado && avaliacao?.decisao === 'preparar_solicitacao') {
    const { plano, pendencias } = planejarRecortes(contexto.processo.id, consolidado);
    const gerados = await gerarAnexos(contexto, id, plano);
    anexos = gerados.anexos;
    for (const p of [...pendencias, ...gerados.falhas]) avisos.push(`Recorte (${String(p.tipo ?? 'documento')}): ${p.motivo}`);
    if (!anexos.length) avisos.push('Nenhum recorte gerado: conferir e anexar manualmente CTPS e procuração.');
  }

  const emails = identificacao.contatos.filter((c) => c.tipo === 'email');
  if (!emails.length) avisos.push('Nenhum e-mail da empresa encontrado: informe o destinatário antes de concluir.');
  else avisos.push(`E-mail sugerido (origem: ${emails[0].origem}) não confirmado: conferir o destinatário.`);
  if (cfg.modoTeste) avisos.push('MODO TESTE: o e-mail irá para o endereço de teste, não para a empresa.');

  if (aberta) {
    await atualizarSolicitacao(aberta.id, (s) => ({
      ...s,
      status: 'substituida',
      historico: [...s.historico, { em: new Date().toISOString(), evento: 'substituida', detalhe: 'Nova análise trouxe outras pendências.' }],
    }));
  }

  const agora = new Date().toISOString();
  const cliente = contexto.processo.emitente?.nome ?? null;
  const solicitacao: Solicitacao = {
    id,
    tipo: 'empresa',
    status: bloqueios.length ? 'bloqueada' : 'aguardando_conferencia',
    criadaEm: agora,
    atualizadaEm: agora,
    execucaoId,
    tarefaId: contexto.tarefa.id,
    tarefaTitulo: contexto.tarefa.titulo,
    processoId: contexto.processo.id,
    clienteNome: cliente,
    responsavel: contexto.tarefa.usuarioResponsavel?.nome ?? null,
    origem: origemDaTarefa(contexto.tarefa),
    empresa: nomeEmpresa,
    empresaChave: chave,
    assinatura,
    modoTeste: cfg.modoTeste,
    destinatario: { nome: nomeEmpresa, telefone: identificacao.contatos.find((c) => c.tipo === 'telefone')?.valor ?? null, email: emails[0]?.valor ?? null },
    assunto: `Solicitação de documentos — ${cliente ?? nomeEmpresa}`,
    texto: textoPedido(cliente, pedidos),
    resumo: avaliacao?.resumo || analise.resumo,
    pendencias: grupo.pendencias,
    confianca: null,
    bloqueios,
    avisos: [...new Set(avisos)],
    anexos,
    detalhes: {
      contatos: identificacao.contatos,
      cnpj: identificacao.cnpj,
      cadastro_cnpja: identificacao.cadastro,
      confirmar_com_cliente: avaliacao?.confirmacoes_com_cliente ?? [],
      pendencias_avaliadas: avaliacao?.pendencias_avaliadas ?? [],
      decisao_avaliacao: avaliacao?.decisao ?? null,
      documentos_localizados: consolidado?.documentos ?? [],
      arquivos_analisados: consolidado?.arquivos_analisados ?? [],
      cobertura_documental: localizacao.cobertura_documental,
    },
    conclusao: null,
    historico: [{ em: agora, evento: 'preparada', detalhe: `Execução ${execucaoId}` }],
  };
  await salvarSolicitacao(solicitacao);

  // "aguardar confirmação do cliente" é um estado esperado: conta como tratada.
  const tratada = bloqueios.length === 0 || avaliacao?.decisao === 'aguardar_confirmacao_cliente';
  return resultado({ tratada, motivo: tratada ? null : bloqueios.join(' '), solicitacaoId: id });
}

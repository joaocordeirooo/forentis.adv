import { randomUUID } from 'node:crypto';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { obterEmitente, obterProcesso } from '@/integrations/lawyertool.integration';
import type { AnaliseTarefa, Pendencia } from '@/models/analise.model';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import type { Solicitacao } from '@/models/solicitacao.model';
import { STATUS_ABERTOS } from '@/models/solicitacao.model';
import { atualizarSolicitacao, buscarAberta, obterSolicitacao, salvarSolicitacao } from '@/repositories/solicitacao.repository';
import { origemDaTarefa } from '@/utils/origem-tarefa.util';
import { normalizarTelefone } from '@/utils/telefone.util';
import { umaLinha } from '@/utils/texto.util';
import type { ClassificarPendencia } from '@/validators/solicitacao.validator';
import { textoPedido } from './solicitacao-empresa.service';
import { assinaturaCliente, assinaturaEmpresa, chaveEmpresa } from './travas.service';

// Pendências que a IA não conseguiu dizer se são do cliente ou de uma empresa.
// Viram uma solicitação "indefinida" na fila; o funcionário classifica cada uma.

const agora = () => new Date().toISOString();

export async function prepararSolicitacaoIndefinida(
  contexto: ContextoTarefa,
  analise: AnaliseTarefa,
  pendencias: Pendencia[],
  execucaoId: string,
): Promise<string> {
  const { tarefa, processo } = contexto;
  const aberta = await buscarAberta(tarefa.id, 'indefinida');
  if (aberta) {
    await atualizarSolicitacao(aberta.id, (s) => ({
      ...s,
      status: 'substituida',
      historico: [...s.historico, { em: agora(), evento: 'substituida', detalhe: `Nova análise (execução ${execucaoId}).` }],
    }));
  }
  const em = agora();
  const solicitacao: Solicitacao = {
    id: randomUUID(),
    tipo: 'indefinida',
    status: 'aguardando_conferencia',
    criadaEm: em,
    atualizadaEm: em,
    execucaoId,
    tarefaId: tarefa.id,
    tarefaTitulo: tarefa.titulo,
    processoId: processo.id,
    clienteNome: processo.emitente?.nome ?? tarefa.emitente?.nome ?? null,
    responsavel: tarefa.usuarioResponsavel?.nome ?? null,
    origem: origemDaTarefa(tarefa),
    empresa: null,
    empresaChave: null,
    assinatura: `indefinida:${tarefa.id}:${em}`,
    modoTeste: config.automacao.modoTeste,
    destinatario: { nome: null, telefone: null, email: null },
    assunto: null,
    texto: '',
    resumo: analise.resumo,
    pendencias,
    confianca: null,
    bloqueios: [],
    avisos: ['A IA não conseguiu definir o destinatário destas pendências. Classifique cada uma: cliente, empresa ou ignorar.'],
    anexos: [],
    detalhes: { duvidas: analise.duvidas },
    conclusao: null,
    historico: [{ em, evento: 'preparada', detalhe: `Execução ${execucaoId}` }],
  };
  await salvarSolicitacao(solicitacao);
  return solicitacao.id;
}

// WhatsApp do cliente pelo cadastro do Lawyertool (best effort).
async function telefoneDoCliente(processoId: number): Promise<{ telefone: string | null; nome: string | null }> {
  try {
    const processo = await obterProcesso(processoId);
    if (!processo.emitente?.id) return { telefone: null, nome: null };
    const pessoa = await obterEmitente(processo.emitente.id);
    return { telefone: normalizarTelefone(pessoa.telefoneWhats), nome: pessoa.nome ?? null };
  } catch {
    return { telefone: null, nome: null };
  }
}

function base(origem: Solicitacao, por: string): Omit<Solicitacao, 'tipo' | 'empresa' | 'empresaChave' | 'assinatura' | 'destinatario' | 'assunto' | 'texto' | 'pendencias' | 'avisos' | 'bloqueios'> {
  const em = agora();
  return {
    id: randomUUID(),
    status: 'aguardando_conferencia',
    criadaEm: em,
    atualizadaEm: em,
    execucaoId: origem.execucaoId,
    tarefaId: origem.tarefaId,
    tarefaTitulo: origem.tarefaTitulo,
    processoId: origem.processoId,
    clienteNome: origem.clienteNome,
    responsavel: origem.responsavel,
    origem: origem.origem,
    modoTeste: config.automacao.modoTeste,
    resumo: origem.resumo,
    confianca: null,
    anexos: [],
    detalhes: { criada_pela_classificacao: origem.id },
    conclusao: null,
    historico: [{ em, evento: 'preparada', por, detalhe: `Classificação de pendência sem destinatário (${origem.id})` }],
  };
}

// Leva a pendência para o pedido ao cliente (junta no que estiver aberto ou cria um novo).
async function paraCliente(origem: Solicitacao, pendencia: Pendencia, por: string): Promise<string> {
  const limite = config.automacao.maxCaracteresTemplate;
  const aberta = await buscarAberta(origem.tarefaId, 'cliente');
  if (aberta) {
    await atualizarSolicitacao(aberta.id, (s) => {
      const pendencias = [...s.pendencias, pendencia];
      const novoTexto = umaLinha(`${s.texto.replace(/[.;\s]+$/, '')}; ${pendencia.documento}.`);
      const cabe = novoTexto.length <= limite;
      return {
        ...s,
        pendencias,
        texto: cabe ? novoTexto : s.texto,
        assinatura: assinaturaCliente(pendencias, s.modoTeste),
        avisos: cabe ? s.avisos : [...s.avisos, `"${pendencia.documento}" foi incluída nas pendências, mas não coube no texto: ajuste a mensagem.`],
        historico: [...s.historico, { em: agora(), evento: 'pendencia_incluida', por, detalhe: pendencia.documento }],
      };
    });
    return aberta.id;
  }

  const { telefone, nome } = await telefoneDoCliente(origem.processoId);
  const texto = umaLinha(`${pendencia.documento}.`).slice(0, limite);
  const nova: Solicitacao = {
    ...base(origem, por),
    tipo: 'cliente',
    empresa: null,
    empresaChave: null,
    assinatura: assinaturaCliente([pendencia], config.automacao.modoTeste),
    destinatario: { nome: nome ?? origem.clienteNome, telefone, email: null },
    assunto: null,
    texto,
    pendencias: [pendencia],
    bloqueios: [],
    avisos: [
      'Pedido criado na classificação: revise o texto do {Documentos_Pendentes} antes de enviar.',
      ...(telefone ? [] : ['Cliente sem WhatsApp válido no cadastro: informe o telefone antes de concluir.']),
      ...(config.automacao.modoTeste ? ['MODO TESTE: a mensagem irá para o número de teste, não para o cliente.'] : []),
    ],
  };
  await salvarSolicitacao(nova);
  return nova.id;
}

// Leva a pendência para o pedido à empresa informada (junta no aberto da mesma empresa ou cria um novo).
async function paraEmpresa(origem: Solicitacao, pendencia: Pendencia, empresa: string, por: string): Promise<string> {
  const chave = chaveEmpresa(empresa);
  const comEmpresa = { ...pendencia, destinatario_tipo: 'empresa', destinatario_nome: empresa };
  const aberta = await buscarAberta(origem.tarefaId, 'empresa', chave);
  if (aberta) {
    await atualizarSolicitacao(aberta.id, (s) => {
      const pendencias = [...s.pendencias, comEmpresa];
      return {
        ...s,
        pendencias,
        assinatura: assinaturaEmpresa(chave, pendencias),
        avisos: [...s.avisos, `"${pendencia.documento}" foi incluída pela classificação: confira se o corpo do e-mail já pede este documento.`],
        historico: [...s.historico, { em: agora(), evento: 'pendencia_incluida', por, detalhe: pendencia.documento }],
      };
    });
    return aberta.id;
  }

  const nova: Solicitacao = {
    ...base(origem, por),
    tipo: 'empresa',
    empresa,
    empresaChave: chave,
    assinatura: assinaturaEmpresa(chave, [comEmpresa]),
    destinatario: { nome: empresa, telefone: null, email: null },
    assunto: `Solicitação de documentos — ${origem.clienteNome ?? empresa}`,
    texto: textoPedido(origem.clienteNome, [{ documento: pendencia.documento, periodo: pendencia.periodo }]),
    pendencias: [comEmpresa],
    bloqueios: [],
    avisos: [
      'Pedido criado na classificação: sem busca automática de CNPJ, contato e recortes. Informe o e-mail e anexe os documentos.',
      ...(config.automacao.modoTeste ? ['MODO TESTE: o e-mail irá para o endereço de teste, não para a empresa.'] : []),
    ],
  };
  await salvarSolicitacao(nova);
  return nova.id;
}

export async function classificarPendencia(id: string, dados: ClassificarPendencia): Promise<Solicitacao> {
  const atual = await obterSolicitacao(id);
  if (!atual) throw new AppError('Solicitação não encontrada.', 404);
  if (atual.tipo !== 'indefinida') throw new AppError('Só pendências sem destinatário são classificadas.', 400);
  if (!STATUS_ABERTOS.includes(atual.status)) throw new AppError(`A solicitação está "${atual.status}" e não pode mais ser alterada.`, 409);
  const pendencia = atual.pendencias[dados.indice];
  if (!pendencia) throw new AppError('Pendência não encontrada.', 404);
  if (pendencia.classificacao) throw new AppError('Esta pendência já foi classificada.', 409);
  if (dados.destino === 'empresa' && !dados.empresa) throw new AppError('Informe o nome da empresa.', 400);

  const { classificacao: _c, ...semClassificacao } = pendencia;
  let destinoId: string | null = null;
  if (dados.destino === 'cliente') destinoId = await paraCliente(atual, { ...semClassificacao, destinatario_tipo: 'cliente', destinatario_nome: null }, dados.por);
  if (dados.destino === 'empresa') destinoId = await paraEmpresa(atual, semClassificacao, dados.empresa!.trim(), dados.por);

  const em = agora();
  const atualizada = await atualizarSolicitacao(id, (s) => {
    const pendencias = s.pendencias.map((p, i) =>
      i === dados.indice
        ? { ...p, classificacao: { destino: dados.destino, empresa: dados.empresa?.trim() || null, solicitacaoId: destinoId, por: dados.por, em } }
        : p,
    );
    const terminou = pendencias.every((p) => p.classificacao);
    const rotulo = dados.destino === 'cliente' ? 'cliente' : dados.destino === 'empresa' ? `empresa ${dados.empresa}` : 'ignorada';
    return {
      ...s,
      pendencias,
      status: terminou ? 'concluida' : s.status,
      conclusao: terminou ? { por: dados.por, em, enviado: false, destino: null, motivo: 'Pendências classificadas.', comentarioRegistrado: false } : s.conclusao,
      historico: [
        ...s.historico,
        { em, evento: 'classificada', por: dados.por, detalhe: `${pendencia.documento} → ${rotulo}` },
        ...(terminou ? [{ em, evento: 'concluida', por: dados.por, detalhe: 'Todas as pendências classificadas.' }] : []),
      ],
    };
  });
  return atualizada!;
}

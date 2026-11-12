import { randomUUID } from 'node:crypto';
import { origemDaTarefa } from '@/utils/origem-tarefa.util';
import { config } from '@/config/env.config';
import { obterEmitente } from '@/integrations/lawyertool.integration';
import type { AnaliseTarefa, Pendencia } from '@/models/analise.model';
import type { ContextoTarefa } from '@/models/contexto-tarefa.model';
import type { Solicitacao } from '@/models/solicitacao.model';
import { atualizarSolicitacao, buscarAberta, salvarSolicitacao } from '@/repositories/solicitacao.repository';
import { normalizarTelefone } from '@/utils/telefone.util';
import { umaLinha } from '@/utils/texto.util';
import { assinaturaCliente, travasCliente } from './travas.service';

export interface ResultadoPreparacao {
  tratada: boolean;
  motivo: string | null; // por que não ficou pronta
  observacao: string | null; // informação para o relatório
  solicitacaoId: string | null;
}

// Texto do {Documentos_Pendentes}: uma linha (o template da Meta não aceita quebra), até o limite.
export function montarTextoCliente(textoIa: string, pendencias: Pendencia[], limite: number) {
  let origem: 'ia' | 'pendencias' = 'ia';
  let texto = umaLinha(textoIa);
  if (!texto) {
    origem = 'pendencias';
    texto = umaLinha(
      pendencias
        .filter((p) => ['solicitar', 'a_confirmar'].includes(String(p.situacao)))
        .map((p) => `${String(p.documento ?? '').trim()}${p.periodo ? ` (${p.periodo})` : ''}`)
        .filter((t) => t.trim())
        .join('; '),
    );
  }
  let resumido = false;
  if (texto.length > limite) {
    const corte = texto.slice(0, limite - 1);
    const ultimo = corte.lastIndexOf(';');
    texto = (ultimo > 40 ? corte.slice(0, ultimo) : corte.slice(0, corte.lastIndexOf(' '))).trim() + '…';
    resumido = true;
  }
  return { texto, origem, resumido };
}

// Prepara a solicitação ao cliente (nó prepararComentarioCliente + checagens do prepararWhatsApp).
// Nada é enviado: a solicitação fica aguardando a conferência do funcionário.
export async function prepararSolicitacaoCliente(
  contexto: ContextoTarefa,
  analise: AnaliseTarefa,
  execucaoId: string,
): Promise<ResultadoPreparacao> {
  const cfg = config.automacao;
  const { tarefa, processo } = contexto;
  const pendencias = analise.pendencias_cliente;

  if (!contexto.comentarios.ok) {
    return {
      tratada: false,
      motivo: `Consulta de comentários da tarefa falhou (${contexto.comentarios.erro}); nada foi preparado para o cliente para evitar duplicidade.`,
      observacao: null,
      solicitacaoId: null,
    };
  }

  const pedidos = pendencias.filter((p) => p.situacao === 'solicitar');
  const confirmacoes = pendencias.filter((p) => p.situacao === 'a_confirmar');
  if (pedidos.length + confirmacoes.length === 0) {
    return {
      tratada: true,
      motivo: null,
      observacao: 'Pendências do cliente só de acompanhamento (já solicitadas ou recebidas); nada a pedir.',
      solicitacaoId: null,
    };
  }

  const { texto, resumido } = montarTextoCliente(analise.texto_cliente, pendencias, cfg.maxCaracteresTemplate);
  const assinatura = assinaturaCliente(pendencias, cfg.modoTeste);
  const travas = travasCliente(contexto.comentarios.data, assinatura, cfg.modoTeste, cfg.diasSemRepetir, cfg.maxCobrancasCliente);

  if (travas.mesmaAssinatura) {
    return { tratada: true, motivo: null, observacao: 'Mensagem com as mesmas pendências já registrada na tarefa.', solicitacaoId: null };
  }
  if (travas.contatoRecente) {
    return {
      tratada: true,
      motivo: null,
      observacao: `Já houve contato automático com o cliente nos últimos ${cfg.diasSemRepetir} dias.`,
      solicitacaoId: null,
    };
  }

  // Já existe uma solicitação aberta para esta tarefa?
  const aberta = await buscarAberta(tarefa.id, 'cliente');
  if (aberta && aberta.assinatura === assinatura) {
    return { tratada: true, motivo: null, observacao: `Solicitação ao cliente já aguardando conferência (${aberta.id}).`, solicitacaoId: aberta.id };
  }
  if (aberta) {
    await atualizarSolicitacao(aberta.id, (s) => ({
      ...s,
      status: 'substituida',
      historico: [...s.historico, { em: new Date().toISOString(), evento: 'substituida', detalhe: 'Nova análise trouxe outras pendências.' }],
    }));
  }

  // WhatsApp do cadastro do cliente.
  const avisos: string[] = [];
  let telefone: string | null = null;
  let nomeCliente = processo.emitente?.nome ?? tarefa.emitente?.nome ?? null;
  try {
    const pessoa = await obterEmitente(processo.emitente!.id);
    telefone = normalizarTelefone(pessoa.telefoneWhats);
    nomeCliente = pessoa.nome ?? nomeCliente;
    if (!telefone) avisos.push('Cliente sem WhatsApp válido no cadastro do Lawyertool: informe o telefone antes de concluir.');
  } catch (erro) {
    avisos.push(`Não foi possível consultar o cadastro do cliente: ${(erro as Error).message}`);
  }

  const bloqueios: string[] = [];
  if (travas.atingiuLimite) {
    bloqueios.push(`Já foram enviadas ${travas.enviosAnteriores} mensagens nesta tarefa (limite ${cfg.maxCobrancasCliente}); a equipe deve tratar.`);
  }
  if (analise.confianca_cliente === 'baixa') {
    bloqueios.push('A IA ficou com confiança baixa sobre o que pedir ao cliente; conferir o texto antes de enviar.');
  }
  if (resumido) avisos.push('O texto foi resumido para caber no template do WhatsApp.');
  if (cfg.modoTeste) avisos.push('MODO TESTE: a mensagem irá para o número de teste, não para o cliente.');

  const agora = new Date().toISOString();
  const solicitacao: Solicitacao = {
    id: randomUUID(),
    tipo: 'cliente',
    status: bloqueios.length ? 'bloqueada' : 'aguardando_conferencia',
    criadaEm: agora,
    atualizadaEm: agora,
    execucaoId,
    tarefaId: tarefa.id,
    tarefaTitulo: tarefa.titulo,
    processoId: processo.id,
    clienteNome: nomeCliente,
    responsavel: tarefa.usuarioResponsavel?.nome ?? null,
    origem: origemDaTarefa(tarefa),
    empresa: null,
    empresaChave: null,
    assinatura,
    modoTeste: cfg.modoTeste,
    destinatario: { nome: nomeCliente, telefone, email: null },
    assunto: null,
    texto,
    resumo: analise.resumo,
    pendencias,
    confianca: analise.confianca_cliente,
    bloqueios,
    avisos,
    anexos: [],
    detalhes: { duvidas: analise.duvidas, envios_anteriores: travas.enviosAnteriores },
    conclusao: null,
    historico: [{ em: agora, evento: 'preparada', detalhe: `Execução ${execucaoId}` }],
  };
  await salvarSolicitacao(solicitacao);

  return {
    tratada: bloqueios.length === 0,
    motivo: bloqueios.length ? `Solicitação ao cliente bloqueada: ${bloqueios.join(' ')}` : null,
    observacao: null,
    solicitacaoId: solicitacao.id,
  };
}

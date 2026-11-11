import { randomUUID } from 'node:crypto';
import { FLUXO_COBRAR_DOCUMENTOS_INVALIDEZ, SETOR_INVALIDEZ } from '@/config/automacoes-tarefas.config';
import { config, estaConfigurado } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { listarTarefasComFiltro } from '@/integrations/lawyertool.integration';
import { dispararCobrancaN8n } from '@/integrations/n8n.integration';
import type { ItemCobranca, PayloadCobrancaN8n, PedidoCobranca, StatusCobrancaTarefa } from '@/models/cobranca-n8n.model';
import { atualizarPedido, listarPedidos, salvarPedido } from '@/repositories/cobranca-n8n.repository';

const SITUACOES_COBRAVEIS = ['pendente', 'iniciada', 'bloqueada'];

interface TarefaCobranca {
  id: number;
  titulo: string | null;
  situacao: string;
  tipoTarefa?: { descricao?: string } | null;
  setor?: { id: number } | null;
  fluxo?: { id: number } | null;
  processo?: { id: number; numeroProcesso?: string | null } | null;
  emitente?: { id: number; nome?: string; telefoneWhats?: string | null } | null;
  usuarioResponsavel?: { nome?: string } | null;
}

export function cobrancaConfigurada(): boolean {
  return estaConfigurado(() => config.n8n);
}

// Manda as tarefas escolhidas para o workflow de cobrança do n8n.
// Confere no Lawyertool que cada tarefa é mesmo do Setor Invalidez / fluxo Cobrar Documentos e está aberta.
export async function solicitarCobranca(tarefaIds: number[], solicitadoPor: string | null): Promise<PedidoCobranca> {
  if (!cobrancaConfigurada()) {
    throw new AppError('A integração com o n8n ainda não está configurada (N8N_COBRANCA_WEBHOOK_URL no .env).', 503);
  }

  const ids = [...new Set(tarefaIds)];
  const resposta = await listarTarefasComFiltro<TarefaCobranca>({
    _page: 1,
    _limit: ids.length,
    id: ids.join(','),
    id_operator: 'in',
    displayFields:
      'id,titulo,situacao,tipoTarefa.descricao,setor.id,fluxo.id,processo.id,processo.numeroProcesso,emitente.id,emitente.nome,emitente.telefoneWhats,usuarioResponsavel.nome',
  });
  const encontradas = new Map((resposta.data ?? []).map((t) => [t.id, t]));

  const recusadas: PedidoCobranca['recusadas'] = [];
  const aceitas: TarefaCobranca[] = [];
  for (const id of ids) {
    const t = encontradas.get(id);
    if (!t) recusadas.push({ tarefaId: id, motivo: 'Tarefa não encontrada no Lawyertool.' });
    else if (t.setor?.id !== SETOR_INVALIDEZ || t.fluxo?.id !== FLUXO_COBRAR_DOCUMENTOS_INVALIDEZ)
      recusadas.push({ tarefaId: id, motivo: 'Não é do Setor Invalidez / fluxo Cobrar Documentos.' });
    else if (!SITUACOES_COBRAVEIS.includes(t.situacao)) recusadas.push({ tarefaId: id, motivo: `Tarefa ${t.situacao}.` });
    else aceitas.push(t);
  }
  if (!aceitas.length) {
    throw new AppError('Nenhuma das tarefas selecionadas pode ser cobrada.', 400, recusadas.map((r) => `#${r.tarefaId}: ${r.motivo}`));
  }

  const agora = new Date().toISOString();
  const pedidoId = randomUUID();
  const { urlForentis } = config.n8n;
  const payload: PayloadCobrancaN8n = {
    origem: 'forentis',
    pedidoId,
    solicitadoPor,
    modoTeste: config.automacao.modoTeste,
    telefoneTeste: config.automacao.modoTeste ? config.automacao.telefoneTeste || null : null,
    urlRetorno: urlForentis ? `${urlForentis}/api/integracoes/n8n/cobranca/retorno` : null,
    tarefas: aceitas.map((t) => ({
      tarefaId: t.id,
      titulo: t.titulo ?? null,
      tipoTarefa: t.tipoTarefa?.descricao ?? null,
      processoId: t.processo?.id ?? null,
      numeroProcesso: t.processo?.numeroProcesso ?? null,
      emitenteId: t.emitente?.id ?? null,
      clienteNome: t.emitente?.nome ?? null,
      telefoneWhats: t.emitente?.telefoneWhats ?? null,
      usuarioResponsavel: t.usuarioResponsavel?.nome ?? null,
    })),
  };

  const itens: ItemCobranca[] = payload.tarefas.map((t) => ({
    tarefaId: t.tarefaId,
    processoId: t.processoId,
    emitenteId: t.emitenteId,
    clienteNome: t.clienteNome,
    status: 'aguardando_n8n',
    detalhe: null,
    atualizadoEm: agora,
  }));

  let pedido: PedidoCobranca;
  try {
    const respostaN8n = await dispararCobrancaN8n(payload);
    pedido = { id: pedidoId, status: 'enviado_ao_n8n', solicitadoPor, itens: itens.map((i) => ({ ...i, detalhe: respostaN8n || null })), recusadas, erro: null, criadoEm: agora, atualizadoEm: agora };
  } catch (erro) {
    const mensagem = (erro as Error).message;
    pedido = { id: pedidoId, status: 'falha_ao_enviar', solicitadoPor, itens: itens.map((i) => ({ ...i, status: 'falha', detalhe: mensagem })), recusadas, erro: mensagem, criadoEm: agora, atualizadoEm: agora };
  }
  await salvarPedido(pedido);
  if (pedido.status === 'falha_ao_enviar') throw new AppError(pedido.erro ?? 'Falha ao enviar ao n8n.', 502);
  return pedido;
}

// Resultado que o n8n devolve: atualiza cada tarefa no pedido mais recente que a contém.
export async function registrarRetorno(
  pedidoId: string | undefined,
  resultados: { tarefaId: number; status: 'enviada' | 'falha' | 'ignorada'; detalhe: string | null }[],
): Promise<{ atualizadas: number; naoEncontradas: number[] }> {
  const pedidos = await listarPedidos();
  const agora = new Date().toISOString();
  const porPedido = new Map<string, typeof resultados>();
  const naoEncontradas: number[] = [];

  for (const r of resultados) {
    const pedido = pedidoId ? pedidos.find((p) => p.id === pedidoId) : pedidos.find((p) => p.itens.some((i) => i.tarefaId === r.tarefaId));
    if (!pedido || !pedido.itens.some((i) => i.tarefaId === r.tarefaId)) {
      naoEncontradas.push(r.tarefaId);
      continue;
    }
    porPedido.set(pedido.id, [...(porPedido.get(pedido.id) ?? []), r]);
  }

  let atualizadas = 0;
  for (const [id, lista] of porPedido) {
    await atualizarPedido(id, (p) => ({
      ...p,
      atualizadoEm: agora,
      itens: p.itens.map((i) => {
        const r = lista.find((x) => x.tarefaId === i.tarefaId);
        if (!r) return i;
        atualizadas++;
        return { ...i, status: r.status, detalhe: r.detalhe, atualizadoEm: agora };
      }),
    }));
  }
  return { atualizadas, naoEncontradas };
}

// Última situação da cobrança de cada tarefa pedida.
export async function statusCobranca(tarefaIds: number[]): Promise<StatusCobrancaTarefa[]> {
  const pedidos = await listarPedidos(); // mais recente primeiro
  const resultado: StatusCobrancaTarefa[] = [];
  for (const id of new Set(tarefaIds)) {
    for (const p of pedidos) {
      const item = p.itens.find((i) => i.tarefaId === id);
      if (item) {
        resultado.push({ tarefaId: id, status: item.status, detalhe: item.detalhe, pedidoId: p.id, atualizadoEm: item.atualizadoEm });
        break;
      }
    }
  }
  return resultado;
}

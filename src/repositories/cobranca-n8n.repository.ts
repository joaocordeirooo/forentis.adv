import type { PedidoCobranca } from '@/models/cobranca-n8n.model';
import { ColecaoJson } from './colecao-json.repository';

const pedidos = new ColecaoJson<PedidoCobranca>('cobrancas-n8n.json');

export async function listarPedidos(): Promise<PedidoCobranca[]> {
  return (await pedidos.listar()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function salvarPedido(pedido: PedidoCobranca) {
  return pedidos.salvar(pedido);
}

export function atualizarPedido(id: string, alterar: (p: PedidoCobranca) => PedidoCobranca) {
  return pedidos.atualizar(id, alterar);
}

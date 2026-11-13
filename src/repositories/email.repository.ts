import type { ConversaEmail } from '@/models/email.model';
import { ColecaoJson } from './colecao-json.repository';

const conversas = new ColecaoJson<ConversaEmail>('emails.json');

export async function listarConversas(): Promise<ConversaEmail[]> {
  return (await conversas.listar()).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

export function obterConversa(id: string) {
  return conversas.obter(id);
}

export async function obterConversaPorSolicitacao(solicitacaoId: string): Promise<ConversaEmail | null> {
  return (await conversas.listar()).find((c) => c.vinculo.solicitacaoId === solicitacaoId) ?? null;
}

export function salvarConversa(conversa: ConversaEmail) {
  return conversas.salvar(conversa);
}

export function atualizarConversa(id: string, alterar: (c: ConversaEmail) => ConversaEmail) {
  return conversas.atualizar(id, alterar);
}

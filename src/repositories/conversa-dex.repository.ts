import type { ConversaDex } from '@/models/dex.model';
import { ColecaoJson } from './colecao-json.repository';

const colecao = new ColecaoJson<ConversaDex>('conversas-dex.json');

export function obterConversa(id: string) {
  return colecao.obter(id);
}

export function salvarConversa(conversa: ConversaDex) {
  return colecao.salvar(conversa);
}

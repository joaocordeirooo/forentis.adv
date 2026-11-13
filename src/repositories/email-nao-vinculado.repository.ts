import type { EmailNaoVinculado } from '@/models/email-recebido.model';
import { ColecaoJson } from './colecao-json.repository';

const naoVinculados = new ColecaoJson<EmailNaoVinculado>('emails-nao-vinculados.json');

export async function listarNaoVinculados(): Promise<EmailNaoVinculado[]> {
  return (await naoVinculados.listar()).sort((a, b) => b.em.localeCompare(a.em));
}

export function obterNaoVinculado(id: string) {
  return naoVinculados.obter(id);
}

export function salvarNaoVinculado(email: EmailNaoVinculado) {
  return naoVinculados.salvar(email);
}

export function atualizarNaoVinculado(id: string, alterar: (e: EmailNaoVinculado) => EmailNaoVinculado) {
  return naoVinculados.atualizar(id, alterar);
}

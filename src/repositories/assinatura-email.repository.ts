import type { AssinaturaEmail } from '@/models/assinatura-email.model';
import { ColecaoJson } from './colecao-json.repository';

const assinaturas = new ColecaoJson<AssinaturaEmail>('assinaturas-email.json');

export async function listarAssinaturas(): Promise<AssinaturaEmail[]> {
  return (await assinaturas.listar()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function obterAssinatura(id: string) {
  return assinaturas.obter(id);
}

export function salvarAssinatura(assinatura: AssinaturaEmail) {
  return assinaturas.salvar(assinatura);
}

export function removerAssinatura(id: string) {
  return assinaturas.remover((a) => a.id === id);
}

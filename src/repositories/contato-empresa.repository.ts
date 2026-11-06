import type { ContatoEmpresa } from '@/models/contato-empresa.model';
import { mesmaEmpresa } from '@/utils/empresa.util';
import { normalizarChave } from '@/utils/texto.util';
import { ColecaoJson } from './colecao-json.repository';

const colecao = new ColecaoJson<ContatoEmpresa>('contatos-empresas.json');

export async function listarContatos(): Promise<ContatoEmpresa[]> {
  const todos = await colecao.listar();
  return todos.sort((a, b) => a.empresa.localeCompare(b.empresa));
}

// Contatos da empresa: nome exato primeiro; se não houver, um nome parecido (sem LTDA, ME, acentos...).
// Se vários cadastros diferentes parecerem com o nome, nenhum é usado (ambíguo) e os nomes vão para conferência.
export async function buscarContatosPorEmpresa(
  nome: string,
): Promise<{ contatos: ContatoEmpresa[]; exato: boolean; ambiguos: string[] }> {
  const todos = await colecao.listar();
  const chave = normalizarChave(nome);
  const exatos = todos.filter((c) => c.empresaChave === chave);
  if (exatos.length) return { contatos: exatos, exato: true, ambiguos: [] };
  const parecidos = todos.filter((c) => mesmaEmpresa(c.empresa, nome));
  const nomes = [...new Set(parecidos.map((c) => c.empresa))];
  if (nomes.length > 1) return { contatos: [], exato: false, ambiguos: nomes.slice(0, 10) };
  return { contatos: parecidos, exato: false, ambiguos: [] };
}

export function salvarContatos(contatos: ContatoEmpresa[]) {
  return colecao.salvarVarios(contatos);
}

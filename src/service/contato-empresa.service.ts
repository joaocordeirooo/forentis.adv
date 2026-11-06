import { randomUUID } from 'node:crypto';
import { AppError } from '@/errors/app.errors';
import type { ContatoEmpresa } from '@/models/contato-empresa.model';
import { listarContatos, salvarContatos } from '@/repositories/contato-empresa.repository';
import { apenasDigitos } from '@/utils/cnpj.util';
import { lerCsv as lerCsvBruto } from '@/utils/csv.util';
import { normalizarChave } from '@/utils/texto.util';
import type { NovoContato } from '@/validators/contato-empresa.validator';

export function listar() {
  return listarContatos();
}

function criarRegistro(dados: NovoContato): ContatoEmpresa {
  return {
    id: randomUUID(),
    empresa: dados.empresa.trim(),
    empresaChave: normalizarChave(dados.empresa),
    cnpj: dados.cnpj ? apenasDigitos(dados.cnpj) || null : null,
    cidade: dados.cidade?.trim() || null,
    contatoNome: dados.contatoNome?.trim() || null,
    email: dados.email?.trim() || null,
    telefone: dados.telefone?.trim() || null,
    observacao: dados.observacao?.trim() || null,
    origem: dados.origem?.trim() || null,
    criadoEm: new Date().toISOString(),
  };
}

export async function adicionar(contatos: NovoContato[]): Promise<ContatoEmpresa[]> {
  const registros = contatos.map(criarRegistro);
  await salvarContatos(registros);
  return registros;
}

// Lê o CSV exportado da Data Table do n8n
// (colunas: empresa, cnpj, unidade_cidade, contato_nome, email, telefone, observacoes, origem).
export function lerCsv(texto: string): NovoContato[] {
  const linhas = lerCsvBruto(texto);
  if (!linhas.length) throw new AppError('CSV sem linhas de dados.', 400);
  if (!('empresa' in linhas[0])) throw new AppError('O CSV precisa de uma coluna "empresa".', 400);
  return linhas
    .filter((l) => l.empresa)
    .map((l) => ({
      empresa: l.empresa,
      cnpj: l.cnpj || undefined,
      cidade: l.unidade_cidade || l.cidade || undefined,
      contatoNome: l.contato_nome || undefined,
      email: l.email || undefined,
      telefone: l.telefone || undefined,
      observacao: l.observacoes || l.observacao || undefined,
      origem: l.origem || undefined,
    }));
}

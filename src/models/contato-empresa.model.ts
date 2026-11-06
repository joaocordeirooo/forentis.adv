// Contato de empresa cadastrado internamente (antiga Data Table "contatos_empresas_importados").
export interface ContatoEmpresa {
  id: string;
  empresa: string;
  empresaChave: string; // nome normalizado, usado na busca
  cnpj: string | null;
  cidade: string | null;
  contatoNome: string | null;
  email: string | null;
  telefone: string | null;
  observacao: string | null;
  origem: string | null;
  criadoEm: string;
}

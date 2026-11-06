import * as contatos from '@/service/contato-empresa.service';
import { importarContatosSchema, novoContatoSchema } from '@/validators/contato-empresa.validator';
import { lerCorpo } from '@/validators/validar';

export async function listarContatos(): Promise<Response> {
  return Response.json(await contatos.listar());
}

export async function criarContato(request: Request): Promise<Response> {
  const dados = await lerCorpo(request, novoContatoSchema);
  const [criado] = await contatos.adicionar([dados]);
  return Response.json(criado, { status: 201 });
}

// POST /api/contatos-empresas/importar — { "contatos": [...] } ou { "csv": "empresa;email;telefone;cnpj\n..." }
export async function importarContatos(request: Request): Promise<Response> {
  const dados = await lerCorpo(request, importarContatosSchema);
  const lista = 'csv' in dados ? contatos.lerCsv(dados.csv) : dados.contatos;
  const criados = await contatos.adicionar(lista);
  return Response.json({ importados: criados.length }, { status: 201 });
}

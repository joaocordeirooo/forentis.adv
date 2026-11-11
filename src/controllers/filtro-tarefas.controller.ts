import { buscarTarefasFiltradas, opcoesFiltroTarefas } from '@/service/filtro-tarefas.service';
import { lerFiltroTarefas } from '@/validators/filtro-tarefas.validator';

// GET /api/tarefas/opcoes?atualizar=1 — setores, fluxos, usuários ativos, situações e automações.
export async function listarOpcoesFiltro(request: Request): Promise<Response> {
  const atualizar = new URL(request.url).searchParams.get('atualizar') === '1';
  return Response.json(await opcoesFiltroTarefas(atualizar));
}

// GET /api/tarefas/filtro?setorId=&fluxoId=&usuarioId=&situacao=pendente,iniciada&dataInicioDe=&...&pagina=1&porPagina=50
export async function filtrarTarefas(request: Request): Promise<Response> {
  return Response.json(await buscarTarefasFiltradas(lerFiltroTarefas(request)));
}

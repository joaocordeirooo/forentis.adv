import { TIPOS_MONITORADOS } from '@/config/tarefas.config';
import { listarTarefas } from '@/integrations/lawyertool.integration';
import type { ResultadoBuscaTarefas, Tarefa } from '@/models/tarefa.model';

const SITUACAO = 'pendente';
const POR_PAGINA = 100;
const MAX_PAGINAS = 20;
const VALIDADE_CACHE_MS = 5 * 60_000; // a lista fica guardada 5 minutos para o painel não consultar o Lawyertool a cada clique
const CAMPOS = [
  'id', 'titulo', 'situacao', 'prioridade', 'dataFinalEsperada',
  'processo.id', 'processo.numeroProcesso',
  'emitente.id', 'emitente.nome',
  'usuarioResponsavel.nome',
  'tipoTarefa.id', 'tipoTarefa.descricao',
  'fluxo.id', 'fluxo.descricao',
].join(',');

let cache: ResultadoBuscaTarefas | null = null;

// Busca as tarefas pendentes de todos os tipos monitorados (config/tarefas.config.ts).
export async function buscarTarefasPendentes(forcar = false): Promise<ResultadoBuscaTarefas> {
  if (!forcar && cache && Date.now() - Date.parse(cache.atualizadoEm) < VALIDADE_CACHE_MS) return cache;

  const tarefas: Tarefa[] = [];
  const porTipo: ResultadoBuscaTarefas['porTipo'] = [];
  let lidas = 0;
  let paginasLidas = 0;
  let buscaIncompleta = false;

  for (const tipo of TIPOS_MONITORADOS) {
    const doTipo: Tarefa[] = [];
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const resposta = await listarTarefas({
        _page: pagina,
        _limit: POR_PAGINA,
        _sort: 'id',
        _order: 'desc',
        fluxo: tipo.fluxoId,
        tipoTarefa: tipo.tipoTarefaId,
        displayFields: CAMPOS,
      });
      const lista = resposta.data ?? [];
      lidas += lista.length;
      paginasLidas++;
      // Confere tudo de novo: a API pode ignorar algum filtro.
      doTipo.push(...lista.filter((t) => t.situacao === SITUACAO && t.tipoTarefa?.id === tipo.tipoTarefaId));
      if (lista.length < POR_PAGINA) break;
      if (pagina === MAX_PAGINAS) buscaIncompleta = true;
    }
    tarefas.push(...doTipo);
    porTipo.push({ tipoTarefaId: tipo.tipoTarefaId, descricao: tipo.descricao, quantidade: doTipo.length, triagem: tipo.triagem });
  }

  if (buscaIncompleta) console.warn(`[tarefas] limite de ${MAX_PAGINAS} páginas atingido em algum tipo; pode haver tarefas não lidas.`);

  cache = {
    tarefas: tarefas.sort((a, b) => b.id - a.id),
    porTipo,
    lidasNoLawyertool: lidas,
    paginasLidas,
    buscaIncompleta,
    atualizadoEm: new Date().toISOString(),
  };
  return cache;
}

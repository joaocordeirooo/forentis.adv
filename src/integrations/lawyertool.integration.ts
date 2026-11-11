import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import type {
  Arquivo,
  Comentario,
  Emitente,
  Movimentacao,
  Processo,
  RespostaItem,
  RespostaPaginada,
} from '@/models/lawyertool.model';
import type { Tarefa } from '@/models/tarefa.model';

type Parametros = Record<string, string | number>;

interface Opcoes {
  parametros?: Parametros;
  metodo?: 'GET' | 'POST';
  corpo?: unknown;
  binario?: boolean;
  timeoutSegundos?: number;
}

// Função base: toda chamada ao Lawyertool passa por aqui.
async function requisitar(caminho: string, opcoes: Opcoes = {}): Promise<Response> {
  const { lawyertool } = config;
  const url = new URL(lawyertool.url + caminho);
  for (const [nome, valor] of Object.entries(opcoes.parametros ?? {})) {
    url.searchParams.set(nome, String(valor));
  }

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: opcoes.metodo ?? 'GET',
      headers: {
        Accept: opcoes.binario ? '*/*' : 'application/json',
        Authorization: `Bearer ${lawyertool.token}`,
        ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout((opcoes.timeoutSegundos ?? 30) * 1000),
    });
  } catch (erro) {
    console.error('[lawyertool] falha de conexão em', url.pathname, erro);
    throw new AppError(`Não foi possível conectar ao Lawyertool (${url.pathname}).`, 502);
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    console.error(`[lawyertool] ${resposta.status} em ${url.pathname}:`, corpo.slice(0, 500));
    throw new AppError(`Lawyertool respondeu ${resposta.status} em ${url.pathname}.`, 502);
  }
  return resposta;
}

async function requisitarJson<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const resposta = await requisitar(caminho, opcoes);
  const texto = await resposta.text();
  return (texto ? JSON.parse(texto) : {}) as T;
}

export function listarTarefas(parametros: Parametros) {
  return requisitarJson<RespostaPaginada<Tarefa>>('/tarefa', { parametros });
}

export async function obterProcesso(processoId: number): Promise<Processo> {
  const resposta = await requisitarJson<RespostaItem<Processo>>(`/processo/${processoId}`);
  return resposta.data;
}

export function listarMovimentacoes(processoId: number) {
  return requisitarJson<RespostaPaginada<Movimentacao>>('/movimento-processo', {
    parametros: {
      _page: 1,
      _limit: 500,
      _sort: 'id',
      _order: 'desc',
      'processo.id': processoId,
      'processo.id_operator': 'equals',
      displayFields:
        'id,processo.id,processo.emitente.id,processo.emitente.nome,tipoMovimento.id,tipoMovimento.descricao,descricao,status.id,status.descricao,destaca',
    },
  });
}

export function listarArquivos(processoId: number, emitenteId: number) {
  return requisitarJson<RespostaPaginada<Arquivo>>('/arquivo', {
    parametros: {
      _page: 1,
      _limit: 500,
      _sort: 'id',
      _order: 'desc',
      'emitente.id': emitenteId,
      'emitente.id_operator': 'equals',
      'processo.id': processoId,
      'processo.id_operator': 'equals',
    },
  });
}

export function listarComentariosTarefa(tarefaId: number) {
  return requisitarJson<RespostaPaginada<Comentario>>(`/tarefa/${tarefaId}/comentarios`);
}

export async function obterEmitente(emitenteId: number): Promise<Emitente> {
  const resposta = await requisitarJson<RespostaItem<Emitente> | Emitente>(`/emitente/${emitenteId}`);
  return 'data' in resposta && resposta.data && !Array.isArray(resposta.data)
    ? (resposta.data as Emitente)
    : (resposta as Emitente);
}

export async function baixarArquivo(arquivoId: number): Promise<Buffer> {
  const resposta = await requisitar(`/arquivo/${arquivoId}/download`, { binario: true, timeoutSegundos: 120 });
  return Buffer.from(await resposta.arrayBuffer());
}

export async function registrarComentarioTarefa(tarefaId: number, conteudo: string): Promise<void> {
  await requisitar(`/tarefa/${tarefaId}/comentario`, { metodo: 'POST', corpo: { conteudo } });
}

// Muda a tarefa de "pendente" para "iniciada" (exige que o token seja do responsável ou de um administrador).
export async function iniciarTarefa(tarefaId: number): Promise<void> {
  await requisitar(`/tarefa/${tarefaId}/iniciar`, { metodo: 'POST', corpo: {} });
}

// ---- Cadastros usados no filtro de tarefas ----

export function listarSetoresTarefa() {
  return requisitarJson<RespostaPaginada<{ id: number; descricao: string; ativo?: boolean }>>('/setor-tarefa', {
    parametros: { _page: 1, _limit: 1000, ativo: 'true', ativo_operator: 'equals' },
  });
}

export function listarFluxosTarefa() {
  return requisitarJson<RespostaPaginada<{ id: number; descricao: string; ativo?: boolean; setor?: { id: number; descricao?: string } | null }>>('/fluxo-tarefa', {
    parametros: { _page: 1, _limit: 1000, ativo: 'true', ativo_operator: 'equals', displayFields: 'id,descricao,ativo,setor.id,setor.descricao' },
  });
}

export function listarUsuariosAtivos() {
  return requisitarJson<RespostaPaginada<{ id: number; nome: string; situacao?: string }>>('/usuario', {
    parametros: { _page: 1, _limit: 1000, situacao: 'Ativo', situacao_operator: 'equals' },
  });
}

// Listagem de tarefas com parâmetros já montados (filtro da tela de tarefas).
export function listarTarefasComFiltro<T>(parametros: Parametros) {
  return requisitarJson<RespostaPaginada<T>>('/tarefa', { parametros });
}

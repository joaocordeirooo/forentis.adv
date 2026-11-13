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
    let motivo = '';
    try {
      const json = JSON.parse(corpo) as { message?: unknown; error?: unknown; erro?: unknown };
      const m = json.message ?? json.erro ?? (typeof json.error === 'object' ? (json.error as { message?: unknown })?.message : json.error);
      motivo = typeof m === 'string' ? m : '';
    } catch {
      motivo = corpo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    throw new AppError(`Lawyertool respondeu ${resposta.status} em ${url.pathname}${motivo ? `: ${motivo.slice(0, 300)}` : '.'}`, 502);
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

export async function obterTarefa(tarefaId: number, displayFields?: string): Promise<Tarefa | null> {
  const resposta = await requisitarJson<RespostaItem<Tarefa>>(`/tarefa/${tarefaId}`, displayFields ? { parametros: { displayFields } } : {});
  return resposta.data ?? null;
}

// Tarefa com todos os campos (tela de cadastro da tarefa no Lawyertool).
export async function obterTarefaCompleta(tarefaId: number): Promise<Record<string, unknown> | null> {
  const resposta = await requisitarJson<RespostaItem<Record<string, unknown>>>(`/tarefa/${tarefaId}`);
  return resposta.data ?? null;
}

export function listarHistoricoTarefa(tarefaId: number) {
  return requisitarJson<RespostaPaginada<Record<string, unknown>>>(`/tarefa/${tarefaId}/historico`);
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

// Conclui a tarefa (pendente/iniciada -> concluída). Só para tipos "tarefa final": não envia próximas tarefas.
export async function concluirTarefa(tarefaId: number): Promise<void> {
  await requisitar(`/tarefa/${tarefaId}/concluir`, { metodo: 'POST', corpo: {} });
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

// ---- Consulta de processos (DEX) — SÓ LEITURA ----

type Registro = Record<string, unknown>;

// Filtro do Lawyertool: campo=valor e campo_operator=operador.
function filtro(campo: string, valor: string | number, operador = 'equals'): Parametros {
  return { [campo]: valor, [`${campo}_operator`]: operador };
}

export function buscarProcessos(criterios: { numero?: string; cliente?: string; cpf?: string; limite?: number }) {
  return requisitarJson<RespostaPaginada<Registro>>('/processo', {
    parametros: {
      _page: 1,
      _limit: criterios.limite ?? 10,
      _sort: 'dataAlt',
      _order: 'desc',
      ...(criterios.numero ? filtro('numeroProcesso', criterios.numero, 'contains') : {}),
      ...(criterios.cliente ? filtro('emitente.nome', criterios.cliente, 'contains') : {}),
      ...(criterios.cpf ? filtro('emitente.cgc', criterios.cpf, 'contains') : {}),
      displayFields:
        'id,numeroProcesso,emitente.id,emitente.nome,status.descricao,tipoProcesso.descricao,procedimento.descricao,situacaoPasta.descricao,localPasta.descricao,dataCad,dataAlt',
    },
  });
}

export async function obterProcessoCompleto(processoId: number): Promise<Registro | null> {
  const resposta = await requisitarJson<RespostaItem<Registro>>(`/processo/${processoId}`);
  return resposta.data ?? null;
}

export function listarMovimentacoesRecentes(processoId: number, limite = 10) {
  return requisitarJson<RespostaPaginada<Registro>>('/movimento-processo', {
    parametros: {
      _page: 1,
      _limit: limite,
      _sort: 'dataCad',
      _order: 'desc',
      ...filtro('processo.id', processoId),
      displayFields: 'id,descricao,dataCad,tipoMovimento.descricao,status.descricao',
    },
  });
}

export function listarPrazosDoProcesso(processoId: number, limite = 15) {
  return requisitarJson<RespostaPaginada<Registro>>('/prazo-processo', {
    parametros: {
      _page: 1,
      _limit: limite,
      _sort: 'dataFim',
      _order: 'desc',
      ...filtro('processo.id', processoId),
      displayFields: 'id,descricao,dataIni,dataFim,tipoPrazo.descricao,status.descricao,usuarioResponsavel.nome',
    },
  });
}

export function listarEventosDoProcesso(processoId: number, limite = 10) {
  return requisitarJson<RespostaPaginada<Registro>>('/evento-processo', {
    parametros: {
      _page: 1,
      _limit: limite,
      _sort: 'dataEvento',
      _order: 'desc',
      ...filtro('processo.id', processoId),
      displayFields: 'id,dataEvento,horaEvento,tipoEvento.descricao,situacaoEvento.descricao,cidadeEvento.nome,usuarioResponsavel.nome',
    },
  });
}

export function listarPublicacoesDoProcesso(processoId: number, limite = 5) {
  return requisitarJson<RespostaPaginada<Registro>>('/publicacao', {
    parametros: {
      _page: 1,
      _limit: limite,
      _sort: 'dataDisponibilizacao',
      _order: 'desc',
      ...filtro('processo.id', processoId),
      displayFields: 'id,dataDisponibilizacao,siglaTribunal,tipoComunicacao,nomeOrgao,foiTratada',
    },
  });
}

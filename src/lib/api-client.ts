'use client';

import type { Atendente, ResultadoMaterialColetado, TarefaAtendimento } from '@/models/atendimento.model';
import type { MensagemDex } from '@/models/dex.model';
import type { AcaoNova, Despesa, ParadaPainel, PosicaoVeiculo } from '@/models/rota.model';
import type { Execucao } from '@/models/execucao.model';
import type { Solicitacao } from '@/models/solicitacao.model';
import type { EstadoTarefa, ResultadoBuscaTarefas, Tarefa } from '@/models/tarefa.model';

// Chamadas do painel para a nossa própria API (/api/...).
// A chave de API (se o .env tiver API_KEY) fica guardada no navegador.

const CHAVE_STORAGE = 'forentis.apiKey';

export function lerChaveApi(): string {
  try {
    return localStorage.getItem(CHAVE_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function salvarChaveApi(chave: string) {
  try {
    localStorage.setItem(CHAVE_STORAGE, chave);
  } catch {
    /* navegador sem armazenamento: segue sem chave */
  }
}

export class ErroApi extends Error {
  constructor(mensagem: string, public status: number, public detalhes?: unknown) {
    super(mensagem);
  }
}

async function chamar<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const resposta = await fetch(caminho, {
    method: opcoes.metodo ?? 'GET',
    headers: {
      'x-api-key': lerChaveApi(),
      ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    cache: 'no-store',
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(dados.erro ?? `Erro ${resposta.status}`, resposta.status, dados.detalhes);
  }
  return dados as T;
}

export interface Saude {
  ok: boolean;
  modoTeste: boolean;
  configurado: Record<string, boolean>;
}

export type ExecucaoResumo = Omit<Execucao, 'resultados'> & { naoTratadas: number };
export type ExecucaoCompleta = Execucao & {
  relatorio: { total: number; tratadas: number; naoTratadas: { tarefaId: number; tarefaTitulo: string | null; clienteNome: string | null; processoId: number | null; motivos: string[] }[]; solicitacoesPreparadas: string[]; texto: string };
};

export interface PainelRota {
  atendente: Atendente;
  semana: { inicio: string; fim: string; diasUteis: string[] };
  base: { nome: string; uf: string; lat: number; lng: number };
  posicao: PosicaoVeiculo;
  rotaHoje: [number, number][];
  rotaSemana: [number, number][][];
  paradas: ParadaPainel[];
  indicadores: {
    pastasResolvidas: number; pastasNasCidadesVisitadas: number; pastasSemana: number;
    kmSemana: number; kmHoje: number; pendenciasDeixadas: number; acoesNovas: number;
    gastosSemana: number; gastosPorCategoria: Record<string, number>; litros: number; kmPorLitro: number | null; custoPorKm: number | null;
  };
  porDia: { data: string; cidades: string[]; km: number | null; resolvidas: number; total: number; pendencias: number; gastos: number; acoesNovas: number }[];
  pendencias: { id: string; cidade: string | null; cliente: string; tipo: string; data: string; descricao: string }[];
  despesas: Despesa[];
  acoes: AcaoNova[];
  fonteRastreador: string;
}

export interface ResumoInicio {
  documentos: { aguardando: number; bloqueadas: number; falhas: number; enviadasHoje: number; ultimaExecucao: { status: string; iniciadaEm: string; naoTratadas: number } | null };
  atendimento: { atendente: string; pendentes: number; hoje: number; atrasadas: number; iniciadas: number };
}

export interface SemanaAtendimento {
  atendentes: Atendente[];
  atendente: Atendente;
  semana: { inicio: string; fim: string; diasUteis: string[] };
  gravaNoLawyertool: boolean;
  tarefas: TarefaAtendimento[];
}

export const api = {
  saude: () => chamar<Saude>('/api/health'),
  tarefas: (atualizar = false) =>
    chamar<Omit<ResultadoBuscaTarefas, 'tarefas'> & { total: number; tarefas: (Tarefa & { estado: EstadoTarefa | null })[] }>(`/api/tarefas${atualizar ? '?atualizar=1' : ''}`),
  execucoes: () => chamar<ExecucaoResumo[]>('/api/analises'),
  execucao: (id: string) => chamar<ExecucaoCompleta>(`/api/analises/${id}`),
  iniciarAnalise: (tarefaId?: number, forcar = false) =>
    chamar<{ execucaoId: string }>('/api/analises', { metodo: 'POST', corpo: { ...(tarefaId ? { tarefaId } : {}), ...(forcar ? { forcar } : {}) } }),
  solicitacoes: () => chamar<Solicitacao[]>('/api/solicitacoes'),
  solicitacao: (id: string) => chamar<Solicitacao>(`/api/solicitacoes/${id}`),
  editar: (id: string, dados: Record<string, unknown>) =>
    chamar<Solicitacao>(`/api/solicitacoes/${id}`, { metodo: 'PATCH', corpo: dados }),
  concluir: (id: string, funcionario: string, ignorarBloqueios: boolean) =>
    chamar<Solicitacao>(`/api/solicitacoes/${id}/concluir`, { metodo: 'POST', corpo: { funcionario, ignorarBloqueios } }),
  descartar: (id: string, funcionario: string, motivo: string) =>
    chamar<Solicitacao>(`/api/solicitacoes/${id}/descartar`, { metodo: 'POST', corpo: { funcionario, motivo } }),
  urlAnexo: (id: string, anexoId: string) => `/api/solicitacoes/${id}/anexos/${anexoId}`,
  atendimento: (atendenteId: string) => chamar<SemanaAtendimento>(`/api/atendimento/tarefas?atendenteId=${atendenteId}`),
  materialColetado: (atendenteId: string, tarefas: string[]) =>
    chamar<{ resultados: ResultadoMaterialColetado[]; iniciadas: number }>('/api/atendimento/material-coletado', { metodo: 'POST', corpo: { atendenteId, tarefas } }),
  inicio: () => chamar<ResumoInicio>('/api/inicio'),
  rota: (atendenteId: string) => chamar<PainelRota>(`/api/rota?atendenteId=${atendenteId}`),
  posicao: (atendenteId: string) => chamar<PosicaoVeiculo>(`/api/rota/posicao?atendenteId=${atendenteId}`),
  registrarDespesa: (dados: Record<string, unknown>) => chamar<Despesa>('/api/rota/despesas', { metodo: 'POST', corpo: dados }),
  apagarDespesa: (atendenteId: string, id: string) => chamar<{ removidas: number }>('/api/rota/despesas', { metodo: 'DELETE', corpo: { atendenteId, id } }),
  registrarAcaoNova: (dados: Record<string, unknown>) => chamar<AcaoNova>('/api/rota/acoes-novas', { metodo: 'POST', corpo: dados }),
  perguntarDex: (texto: string, conversaId?: string, pessoa?: string) =>
    chamar<{ conversaId: string; resposta: MensagemDex }>('/api/dex/mensagens', { metodo: 'POST', corpo: { texto, conversaId, pessoa } }),
  conversaDex: (id: string) => chamar<{ id: string; mensagens: MensagemDex[] }>(`/api/dex/conversas/${id}`),
  recriarExemplos: (atendenteId: string) => chamar<SemanaAtendimento>('/api/atendimento/exemplos', { metodo: 'POST', corpo: { atendenteId } }),
};

import { randomUUID } from 'node:crypto';
import { MAX_ATUALIZACOES_AGENTE } from '@/config/agentes.config';
import { AppError } from '@/errors/app.errors';
import type { Agente, AtualizacaoAgente } from '@/models/agente.model';
import * as repositorio from '@/repositories/agente.repository';
import type { z } from 'zod';
import type { atualizacaoAgenteSchema, criarAgenteSchema, editarAgenteSchema } from '@/validators/agente.validator';

type DadosCriar = z.infer<typeof criarAgenteSchema>;
type DadosEditar = z.infer<typeof editarAgenteSchema>;
type DadosAtualizacao = z.infer<typeof atualizacaoAgenteSchema>;

const limparFerramentas = (lista: string[]) => [...new Set(lista.map((f) => f.trim()).filter(Boolean))];

export function listar() {
  return repositorio.listarAgentes();
}

export async function obter(id: string): Promise<Agente> {
  const agente = await repositorio.obterAgente(id);
  if (!agente) throw new AppError('Agente não encontrado.', 404);
  return agente;
}

export async function criar(dados: DadosCriar): Promise<Agente> {
  const agora = new Date().toISOString();
  const { fazendoAgora, autor, ...campos } = dados;
  const primeira: AtualizacaoAgente[] = fazendoAgora ? [{ id: randomUUID(), texto: fazendoAgora, autor, criadaEm: agora }] : [];
  return repositorio.salvarAgente({
    id: randomUUID(),
    ...campos,
    ferramentas: limparFerramentas(campos.ferramentas),
    fazendoAgora: fazendoAgora ?? null,
    atualizacoes: primeira,
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

export async function editar(id: string, dados: DadosEditar): Promise<Agente> {
  const agente = await repositorio.atualizarAgente(id, (a) => ({
    ...a,
    ...dados,
    ferramentas: dados.ferramentas ? limparFerramentas(dados.ferramentas) : a.ferramentas,
    atualizadoEm: new Date().toISOString(),
  }));
  if (!agente) throw new AppError('Agente não encontrado.', 404);
  return agente;
}

// Registra o que o agente está fazendo agora (entra no topo do histórico).
export async function registrarAtualizacao(id: string, dados: DadosAtualizacao): Promise<Agente> {
  const agora = new Date().toISOString();
  const nova: AtualizacaoAgente = { id: randomUUID(), texto: dados.texto, autor: dados.autor, criadaEm: agora };
  const agente = await repositorio.atualizarAgente(id, (a) => ({
    ...a,
    fazendoAgora: nova.texto,
    atualizacoes: [nova, ...a.atualizacoes].slice(0, MAX_ATUALIZACOES_AGENTE),
    atualizadoEm: agora,
  }));
  if (!agente) throw new AppError('Agente não encontrado.', 404);
  return agente;
}

// Apaga uma atualização do histórico; "fazendo agora" passa a ser a mais recente que sobrou.
export async function removerAtualizacao(id: string, atualizacaoId: string): Promise<Agente> {
  const agente = await repositorio.atualizarAgente(id, (a) => {
    const atualizacoes = a.atualizacoes.filter((u) => u.id !== atualizacaoId);
    return { ...a, atualizacoes, fazendoAgora: atualizacoes[0]?.texto ?? null, atualizadoEm: new Date().toISOString() };
  });
  if (!agente) throw new AppError('Agente não encontrado.', 404);
  return agente;
}

export async function excluir(id: string): Promise<void> {
  const removidos = await repositorio.removerAgente(id);
  if (!removidos) throw new AppError('Agente não encontrado.', 404);
}

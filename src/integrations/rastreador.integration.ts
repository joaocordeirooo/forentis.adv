import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import type { PontoTrajeto, PosicaoVeiculo } from '@/models/rota.model';
import { pastasPorCidadeExemplo } from '@/service/atendimento-exemplos.service';
import { posicaoAgora, trajetoDoDia } from '@/service/rastreador-simulado.service';

// Ponto único de contato com o rastreador do carro.
// Hoje: "simulado". Para ligar o rastreador real, implemente as duas funções abaixo para o novo provedor
// (posição atual e pontos do trajeto de um dia) e troque RASTREADOR_PROVEDOR no .env.

export async function obterPosicao(_veiculo: string): Promise<PosicaoVeiculo> {
  const provedor = config.atendimento.rastreador;
  if (provedor === 'simulado') {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return posicaoAgora(hoje, pastasPorCidadeExemplo());
  }
  throw new AppError(`Rastreador "${provedor}" ainda não implementado.`, 501);
}

export async function obterTrajetoDoDia(_veiculo: string, data: string): Promise<PontoTrajeto[]> {
  const provedor = config.atendimento.rastreador;
  if (provedor === 'simulado') return trajetoDoDia(data, pastasPorCidadeExemplo(), new Date());
  throw new AppError(`Rastreador "${provedor}" ainda não implementado.`, 501);
}

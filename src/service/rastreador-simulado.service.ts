import { BASE, CIDADES, PLANO_SEMANA_EXEMPLO } from '@/config/rota.config';
import type { PontoTrajeto, PosicaoVeiculo } from '@/models/rota.model';
import { distanciaKm, rumo } from '@/utils/geo.util';
import { semanaAtual } from '@/utils/semana.util';

// Simula o rastreador do carro do atendente fictício: ele sai da base às 7h30,
// passa pelas cidades do roteiro do dia (30 min por pasta) e volta.
// Tudo é calculado a partir do relógio, então a posição "anda" em tempo real.

const SAIDA_MIN = 7 * 60 + 30;
const VELOCIDADE_MEDIA = 72; // km/h
const FATOR_ESTRADA = 1.3; // estrada não é linha reta
const MIN_POR_PASTA = 30;

export interface ParadaAgenda {
  chave: string;
  chegada: Date;
  saida: Date;
}

// Hora local de São Paulo (UTC-3) → Date.
function horario(data: string, minutos: number): Date {
  return new Date(new Date(`${data}T00:00:00-03:00`).getTime() + minutos * 60_000);
}

export function cidadesDoDia(data: string): string[] {
  const indice = semanaAtual().diasUteis.indexOf(data);
  return indice >= 0 ? PLANO_SEMANA_EXEMPLO[indice] : [];
}

// Horários de chegada e saída em cada cidade do dia.
export function agendaDoDia(data: string, pastasPorCidade: Record<string, number>) {
  const cidades = cidadesDoDia(data);
  const paradas: ParadaAgenda[] = [];
  let minuto = SAIDA_MIN;
  let anterior = CIDADES[BASE];
  for (const chave of cidades) {
    const cidade = CIDADES[chave];
    minuto += ((distanciaKm(anterior, cidade) * FATOR_ESTRADA) / VELOCIDADE_MEDIA) * 60;
    const chegada = horario(data, minuto);
    minuto += Math.max(20, (pastasPorCidade[chave] ?? 1) * MIN_POR_PASTA);
    paradas.push({ chave, chegada, saida: horario(data, minuto) });
    anterior = cidade;
  }
  const volta = cidades.length ? horario(data, minuto + ((distanciaKm(anterior, CIDADES[BASE]) * FATOR_ESTRADA) / VELOCIDADE_MEDIA) * 60) : null;
  return { saida: horario(data, SAIDA_MIN), paradas, volta };
}

// Pequena curva lateral para o trajeto parecer estrada (determinística).
function pontoNoTrecho(a: { lat: number; lng: number }, b: { lat: number; lng: number }, f: number, semente: number) {
  const curva = Math.sin(f * Math.PI) * 0.06 * Math.sin(semente + f * 9);
  return {
    lat: a.lat + (b.lat - a.lat) * f + -(b.lng - a.lng) * curva * 0.5,
    lng: a.lng + (b.lng - a.lng) * f + (b.lat - a.lat) * curva * 0.5,
  };
}

interface Trecho {
  de: { lat: number; lng: number };
  para: { lat: number; lng: number };
  inicio: number; // ms
  fim: number;
  parado: boolean;
}

function trechosDoDia(data: string, pastasPorCidade: Record<string, number>): Trecho[] {
  const agenda = agendaDoDia(data, pastasPorCidade);
  if (!agenda.paradas.length || !agenda.volta) return [];
  const trechos: Trecho[] = [];
  let anterior = CIDADES[BASE];
  let tempo = agenda.saida.getTime();
  for (const p of agenda.paradas) {
    const cidade = CIDADES[p.chave];
    trechos.push({ de: anterior, para: cidade, inicio: tempo, fim: p.chegada.getTime(), parado: false });
    trechos.push({ de: cidade, para: cidade, inicio: p.chegada.getTime(), fim: p.saida.getTime(), parado: true });
    anterior = cidade;
    tempo = p.saida.getTime();
  }
  trechos.push({ de: anterior, para: CIDADES[BASE], inicio: tempo, fim: agenda.volta.getTime(), parado: false });
  return trechos;
}

// Trajeto do dia até "ate" (pontos a cada 3 minutos de estrada).
export function trajetoDoDia(data: string, pastasPorCidade: Record<string, number>, ate: Date): PontoTrajeto[] {
  const pontos: PontoTrajeto[] = [];
  const limite = ate.getTime();
  trechosDoDia(data, pastasPorCidade).forEach((t, i) => {
    if (t.inicio > limite) return;
    const passo = (t.parado ? 15 : 3) * 60_000;
    const fim = Math.min(t.fim, limite);
    for (let ms = t.inicio; ms <= fim; ms += passo) {
      const f = t.fim === t.inicio ? 1 : (ms - t.inicio) / (t.fim - t.inicio);
      const p = t.parado ? t.de : pontoNoTrecho(t.de, t.para, f, i);
      pontos.push({ ...p, em: new Date(ms).toISOString(), velocidade: t.parado ? 0 : Math.round(VELOCIDADE_MEDIA + 10 * Math.sin(ms / 400_000)) });
    }
  });
  return pontos;
}

export function posicaoAgora(data: string, pastasPorCidade: Record<string, number>, agora = new Date()): PosicaoVeiculo {
  const base = CIDADES[BASE];
  const parado = (lat: number, lng: number, cidade: string): PosicaoVeiculo => ({
    lat, lng, em: agora.toISOString(), velocidade: 0, situacao: 'parado', rumo: 0, cidadeProxima: cidade, fonte: 'simulado',
  });
  const trechos = trechosDoDia(data, pastasPorCidade);
  const t = trechos.find((x) => agora.getTime() >= x.inicio && agora.getTime() <= x.fim);
  if (!t) return parado(base.lat, base.lng, base.nome);
  if (t.parado) {
    const cidade = Object.values(CIDADES).find((c) => c.lat === t.de.lat && c.lng === t.de.lng);
    return parado(t.de.lat, t.de.lng, cidade?.nome ?? '');
  }
  const i = trechos.indexOf(t);
  const f = (agora.getTime() - t.inicio) / (t.fim - t.inicio);
  const p = pontoNoTrecho(t.de, t.para, f, i);
  const adiante = pontoNoTrecho(t.de, t.para, Math.min(1, f + 0.01), i);
  const destino = Object.values(CIDADES).find((c) => c.lat === t.para.lat && c.lng === t.para.lng);
  return {
    ...p,
    em: agora.toISOString(),
    velocidade: Math.round(VELOCIDADE_MEDIA + 10 * Math.sin(agora.getTime() / 400_000)),
    situacao: 'em_movimento',
    rumo: rumo(p, adiante),
    cidadeProxima: destino ? `a caminho de ${destino.nome}` : null,
    fonte: 'simulado',
  };
}

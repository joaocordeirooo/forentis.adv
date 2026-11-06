import type { CategoriaDespesa } from '@/config/rota.config';

export interface PontoTrajeto {
  lat: number;
  lng: number;
  em: string; // ISO
  velocidade: number; // km/h
}

export interface PosicaoVeiculo extends PontoTrajeto {
  situacao: 'em_movimento' | 'parado';
  rumo: number; // graus (0 = norte), para girar o ícone do carro
  cidadeProxima: string | null;
  fonte: 'simulado' | 'rastreador';
}

export interface Despesa {
  id: string;
  atendenteId: string;
  data: string; // AAAA-MM-DD
  categoria: CategoriaDespesa;
  valor: number;
  descricao: string | null;
  cidade: string | null;
  litros: number | null; // combustível
  exemplo: boolean;
  criadaEm: string;
}

export interface AcaoNova {
  id: string;
  atendenteId: string;
  data: string;
  cliente: string;
  cidade: string;
  tipo: string; // ex.: "Aposentadoria por invalidez"
  observacao: string | null;
  exemplo: boolean;
  criadaEm: string;
}

export interface ParadaPainel {
  chave: string;
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
  data: string;
  chegada: string | null;
  saida: string | null;
  visitada: boolean; // o carro já saiu da cidade
  noLocal: boolean; // o carro está lá agora
  total: number;
  resolvidas: number;
  pendentes: number;
}

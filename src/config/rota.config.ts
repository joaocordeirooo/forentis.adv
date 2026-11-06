// Cidades atendidas e a rota de EXEMPLO da semana (atendente fictício).
// Quando o rastreador real for conectado, a posição e o trajeto passam a vir dele.

export interface Cidade {
  nome: string;
  uf: string;
  lat: number;
  lng: number;
}

export const CIDADES: Record<string, Cidade> = {
  fraiburgo: { nome: 'Fraiburgo', uf: 'SC', lat: -27.0262, lng: -50.9214 },
  videira: { nome: 'Videira', uf: 'SC', lat: -27.0086, lng: -51.1543 },
  cacador: { nome: 'Caçador', uf: 'SC', lat: -26.7753, lng: -51.0122 },
  curitibanos: { nome: 'Curitibanos', uf: 'SC', lat: -27.2829, lng: -50.5816 },
  lages: { nome: 'Lages', uf: 'SC', lat: -27.816, lng: -50.3264 },
  camposnovos: { nome: 'Campos Novos', uf: 'SC', lat: -27.402, lng: -51.2248 },
  joacaba: { nome: 'Joaçaba', uf: 'SC', lat: -27.1721, lng: -51.5108 },
  vacaria: { nome: 'Vacaria', uf: 'RS', lat: -28.5122, lng: -50.9339 },
  lebonregis: { nome: 'Lebon Régis', uf: 'SC', lat: -26.9281, lng: -50.6922 },
  montecarlo: { nome: 'Monte Carlo', uf: 'SC', lat: -27.2214, lng: -50.9811 },
};

// Base do atendente (escritório): sai e volta para cá todo dia.
export const BASE = 'fraiburgo';

// Roteiro de exemplo: índice 0 = segunda ... 4 = sexta.
export const PLANO_SEMANA_EXEMPLO: string[][] = [
  ['videira', 'cacador'],
  ['curitibanos', 'lages'],
  ['camposnovos', 'joacaba'],
  ['vacaria'],
  ['lebonregis', 'montecarlo'],
];

export const CATEGORIAS_DESPESA = {
  alimentacao: 'Alimentação',
  combustivel: 'Combustível',
  pedagio: 'Pedágio',
  estacionamento: 'Estacionamento',
  hospedagem: 'Hospedagem',
  manutencao: 'Manutenção',
  outros: 'Outros',
} as const;

export type CategoriaDespesa = keyof typeof CATEGORIAS_DESPESA;

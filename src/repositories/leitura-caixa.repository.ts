import type { EstadoLeituraCaixa } from '@/models/email-recebido.model';
import { ColecaoJson } from './colecao-json.repository';

const estados = new ColecaoJson<EstadoLeituraCaixa>('email-leitura.json');
const ID = 'caixa';

export async function obterEstadoLeitura(pasta: string): Promise<EstadoLeituraCaixa> {
  const estado = await estados.obter(ID);
  // Trocou a pasta no .env: começa do zero (a numeração de uma pasta não vale para outra).
  if (!estado || estado.pasta !== pasta) {
    return { id: ID, pasta, uidValidity: null, ultimoUid: 0, ultimaLeitura: null, ultimoResumo: estado?.ultimoResumo ?? null };
  }
  return estado;
}

export function salvarEstadoLeitura(estado: EstadoLeituraCaixa) {
  return estados.salvar({ ...estado, id: ID });
}

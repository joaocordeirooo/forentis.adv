import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';

export interface CadastroCnpja {
  taxId?: string;
  updated?: string;
  company?: { name?: string };
  status?: { text?: string };
  address?: { city?: string; state?: string };
  emails?: { address?: string }[];
  phones?: { area?: string; number?: string; type?: string }[];
}

// Consulta pública da CNPJa (sem chave; tem limite de consultas por minuto).
export async function consultarCnpj(cnpj: string): Promise<CadastroCnpja> {
  let resposta: Response;
  try {
    resposta = await fetch(`${config.cnpja.url}/office/${cnpj}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (erro) {
    throw new AppError(`Falha de conexão com a CNPJa: ${(erro as Error).message}`, 502);
  }
  if (!resposta.ok) {
    throw new AppError(`CNPJa respondeu ${resposta.status} para o CNPJ ${cnpj}.`, 502);
  }
  return (await resposta.json()) as CadastroCnpja;
}

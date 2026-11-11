import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import type { PayloadCobrancaN8n } from '@/models/cobranca-n8n.model';

// Dispara o workflow de cobrança de documentos no n8n (nó Webhook, método POST).
// Devolve o corpo que o n8n respondeu (texto curto), só para registro.
export async function dispararCobrancaN8n(payload: PayloadCobrancaN8n): Promise<string> {
  const { cobrancaUrl, token, timeoutSegundos } = config.n8n;
  let resposta: Response;
  try {
    resposta = await fetch(cobrancaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-forentis-token': token } : {}) },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutSegundos * 1000),
    });
  } catch (erro) {
    console.error('[n8n] falha de conexão no webhook de cobrança', erro);
    throw new AppError('Não foi possível conectar ao n8n (webhook de cobrança).', 502);
  }
  const texto = await resposta.text().catch(() => '');
  if (!resposta.ok) {
    console.error(`[n8n] ${resposta.status} no webhook de cobrança:`, texto.slice(0, 500));
    throw new AppError(`O n8n respondeu ${resposta.status} no webhook de cobrança.`, 502);
  }
  return texto.slice(0, 500);
}

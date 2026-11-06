import { config } from '@/config/env.config';

export interface RespostaChatGuru {
  ok: boolean; // result === "success"
  status: number;
  dados: Record<string, unknown>;
  bruto: string;
}

// Chamada base: o ChatGuru recebe tudo como formulário, com as credenciais na URL.
async function chamar(acao: string, campos: Record<string, string>): Promise<RespostaChatGuru> {
  const cg = config.chatguru;
  const url = new URL(cg.url);
  url.searchParams.set('key', cg.chave);
  url.searchParams.set('account_id', cg.contaId);
  url.searchParams.set('phone_id', cg.telefoneId);

  const corpo = new URLSearchParams({ action: acao, ...campos });

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corpo,
      signal: AbortSignal.timeout(60_000),
    });
    const bruto = await resposta.text();
    let dados: Record<string, unknown> = {};
    try {
      dados = JSON.parse(bruto);
    } catch {
      dados = { description: bruto.slice(0, 300) };
    }
    return { ok: String(dados.result ?? '').toLowerCase() === 'success', status: resposta.status, dados, bruto };
  } catch (erro) {
    const mensagem = `falha de conexão: ${(erro as Error).message}`;
    return { ok: false, status: 0, dados: { description: mensagem }, bruto: mensagem };
  }
}

export function atualizarCampos(numero: string, campos: Record<string, string>) {
  const camposFormatados = Object.fromEntries(Object.entries(campos).map(([nome, valor]) => [`field__${nome}`, valor]));
  return chamar('chat_update_custom_fields', { chat_number: numero, ...camposFormatados });
}

export function adicionarChat(numero: string, nome: string, texto: string, dialogo: string) {
  return chamar('chat_add', { chat_number: numero, name: nome, text: texto, dialog_id: dialogo });
}

export function consultarStatusChat(chatAddId: string) {
  return chamar('chat_add_status', { chat_add_id: chatAddId });
}

export function atualizarContexto(numero: string, contexto: Record<string, string>) {
  const formatado = Object.fromEntries(Object.entries(contexto).map(([nome, valor]) => [`context__${nome}`, valor]));
  return chamar('chat_update_context', { chat_number: numero, ...formatado });
}

export function executarDialogo(numero: string, dialogo: string) {
  return chamar('dialog_execute', { chat_number: numero, dialog_id: dialogo });
}

// Detecta a resposta "chat não encontrado" (regra dos nós avaliarCampos do n8n).
export function chatInexistente(resposta: RespostaChatGuru): boolean {
  return !resposta.ok && /n[aã]o\s+(foi\s+)?encontrad|not\s+found|inexistente|does\s+not\s+exist/i.test(resposta.bruto);
}

export function descreverFalha(resposta: RespostaChatGuru): string {
  return String(resposta.dados.description ?? resposta.bruto.slice(0, 200));
}

import { randomUUID } from 'node:crypto';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { conversarComFerramentas } from '@/integrations/openai.integration';
import type { ConversaDex } from '@/models/dex.model';
import { obterConversa, salvarConversa } from '@/repositories/conversa-dex.repository';
import { carregarPrompt } from '@/utils/prompt.util';
import { executarFerramentaDex, FERRAMENTAS_DEX } from './dex-ferramentas.service';

const HISTORICO = 12; // últimas mensagens enviadas à IA (o resto fica só guardado)

export async function obter(id: string): Promise<ConversaDex> {
  const conversa = await obterConversa(id);
  if (!conversa) throw new AppError('Conversa não encontrada.', 404);
  return conversa;
}

// Recebe a pergunta, deixa a DEX consultar o sistema e guarda as duas mensagens.
export async function perguntar(dados: { conversaId?: string; pessoa?: string; texto: string }) {
  const agora = new Date().toISOString();
  const conversa: ConversaDex = (dados.conversaId && (await obterConversa(dados.conversaId))) || {
    id: randomUUID(),
    pessoa: dados.pessoa?.trim() || null,
    criadaEm: agora,
    atualizadaEm: agora,
    mensagens: [],
  };
  conversa.mensagens.push({ papel: 'pessoa', texto: dados.texto.trim(), em: agora });

  const instrucoes = [
    await carregarPrompt('dex'),
    `\nAGORA: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (horário de Brasília).`,
    conversa.pessoa ? `Você está conversando com: ${conversa.pessoa}.` : '',
  ].join('\n');

  const { texto, ferramentasUsadas } = await conversarComFerramentas({
    modelo: config.openai.modeloDex,
    instrucoes,
    mensagens: conversa.mensagens.slice(-HISTORICO).map((m) => ({ role: m.papel === 'pessoa' ? 'user' : 'assistant', content: m.texto })),
    ferramentas: FERRAMENTAS_DEX,
    executar: executarFerramentaDex,
  });

  const resposta = { papel: 'dex' as const, texto, em: new Date().toISOString(), consultas: ferramentasUsadas };
  conversa.mensagens.push(resposta);
  conversa.atualizadaEm = resposta.em;
  await salvarConversa(conversa);
  return { conversaId: conversa.id, resposta };
}

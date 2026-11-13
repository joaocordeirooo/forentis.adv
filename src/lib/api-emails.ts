'use client';

import type { AssinaturaEmail } from '@/models/assinatura-email.model';
import type { EmailNaoVinculado, ResumoLeitura } from '@/models/email-recebido.model';
import type { ConversaEmail, ResultadoEnvioEmail, StatusConversa, TipoVinculo } from '@/models/email.model';
import type { resumo } from '@/service/caixa-email.service';
import { ErroApi, lerChaveApi } from './api-client';

// Chamadas da estação E-mails para a API (/api/emails/...). Mesma chave de API do resto do painel.

async function chamar<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; form?: FormData } = {}): Promise<T> {
  const resposta = await fetch(caminho, {
    method: opcoes.metodo ?? 'GET',
    headers: {
      'x-api-key': lerChaveApi(),
      ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opcoes.form ?? (opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined),
    cache: 'no-store',
  });
  const tipo = resposta.headers.get('content-type') ?? '';
  const dados = tipo.includes('application/json') ? await resposta.json().catch(() => ({})) : await resposta.text();
  // 502 no envio = não saiu, mas a conversa foi registrada: devolve o resultado para a tela mostrar o motivo.
  if (!resposta.ok && !(resposta.status === 502 && typeof dados === 'object' && dados && 'conversa' in dados)) {
    const erro = typeof dados === 'object' && dados ? (dados as { erro?: string; detalhes?: unknown }) : {};
    throw new ErroApi(erro.erro ?? `Erro ${resposta.status}`, resposta.status, erro.detalhes);
  }
  return dados as T;
}

export type ResumoCaixa = Awaited<ReturnType<typeof resumo>>;

export interface TesteConexao {
  conta: string;
  smtp: { ok: boolean; servidor: string; erro: string | null };
  imap: { ok: boolean; servidor: string; erro: string | null };
  pastaEnviados: { nome: string; existe: boolean };
  pastas: string[];
}

export interface AnexoBase64 {
  nome: string;
  conteudoBase64: string;
  mimeType?: string;
}

export interface DadosEnvio {
  conversaId?: string;
  para: string[];
  cc?: string[];
  assunto?: string;
  texto: string;
  funcionario: string;
  vinculo?: { tipo: TipoVinculo; tarefaId?: number | null; empresa?: string | null };
  anexos?: AnexoBase64[];
}

export type DadosAssinatura = Pick<AssinaturaEmail, 'nome' | 'cargo' | 'oab' | 'telefone' | 'whatsapp' | 'email' | 'ativa'>;

export const apiEmails = {
  resumo: () => chamar<ResumoCaixa>('/api/emails/resumo'),
  conversas: (filtro: { status?: StatusConversa; busca?: string } = {}) => {
    const p = new URLSearchParams();
    if (filtro.status) p.set('status', filtro.status);
    if (filtro.busca) p.set('busca', filtro.busca);
    return chamar<ConversaEmail[]>(`/api/emails?${p}`);
  },
  conversa: (id: string) => chamar<ConversaEmail>(`/api/emails/${id}`),
  enviar: (dados: DadosEnvio) => chamar<ResultadoEnvioEmail>('/api/emails', { metodo: 'POST', corpo: dados }),
  conferir: (id: string) => chamar<ConversaEmail>(`/api/emails/${id}/conferir`, { metodo: 'POST' }),
  lerCaixa: () => chamar<ResumoLeitura>('/api/emails/ler-caixa', { metodo: 'POST' }),
  testarConexao: () => chamar<TesteConexao>('/api/emails/testar-conexao'),
  urlAnexo: (conversaId: string, mensagemId: string, indice: number) => `/api/emails/${conversaId}/anexos/${mensagemId}/${indice}`,

  naoVinculados: (situacao: EmailNaoVinculado['situacao'] | 'todos' = 'pendente') =>
    chamar<EmailNaoVinculado[]>(`/api/emails/nao-vinculados?situacao=${situacao}`),
  vincular: (id: string, conversaId: string, funcionario: string) =>
    chamar<ConversaEmail>(`/api/emails/nao-vinculados/${id}/vincular`, { metodo: 'POST', corpo: { conversaId, funcionario } }),
  descartar: (id: string, funcionario: string) =>
    chamar<EmailNaoVinculado>(`/api/emails/nao-vinculados/${id}/descartar`, { metodo: 'POST', corpo: { funcionario } }),
  urlAnexoNaoVinculado: (id: string, indice: number) => `/api/emails/nao-vinculados/${id}/anexos/${indice}`,

  assinaturas: () => chamar<AssinaturaEmail[]>('/api/emails/assinaturas'),
  criarAssinatura: (dados: DadosAssinatura) => chamar<AssinaturaEmail>('/api/emails/assinaturas', { metodo: 'POST', corpo: dados }),
  editarAssinatura: (id: string, dados: Partial<DadosAssinatura> & { imagem?: string | null }) =>
    chamar<AssinaturaEmail>(`/api/emails/assinaturas/${id}`, { metodo: 'PATCH', corpo: dados }),
  excluirAssinatura: (id: string) => chamar<{ removida: boolean }>(`/api/emails/assinaturas/${id}`, { metodo: 'DELETE' }),
  enviarImagemAssinatura: (id: string, arquivo: File) => {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return chamar<AssinaturaEmail>(`/api/emails/assinaturas/${id}/imagem`, { metodo: 'POST', form });
  },
  previaAssinatura: (id: string) => chamar<string>(`/api/emails/assinaturas/${id}/previa`),
};

// Arquivo do navegador → base64 (para anexar no envio).
export async function arquivoParaBase64(arquivo: File): Promise<AnexoBase64> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { nome: arquivo.name, conteudoBase64: btoa(binario), mimeType: arquivo.type || undefined };
}

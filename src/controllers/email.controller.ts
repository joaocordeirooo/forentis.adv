import { AppError } from '@/errors/app.errors';
import { testarConexaoEmail } from '@/integrations/email.integration';
import * as caixa from '@/service/caixa-email.service';
import { lerCaixa } from '@/service/leitura-caixa.service';
import { enviarEmailSchema, filtroMonitoramentoSchema } from '@/validators/email.validator';
import { lerCorpo } from '@/validators/validar';

type ComId = { params: Promise<{ id: string }> };

// GET /api/emails?status=&tipo=&tarefaId=&solicitacaoId=&busca=&semResposta=true&respostaNova=true — conversas, mais recentes primeiro
export async function listarConversas(request: Request): Promise<Response> {
  const consulta = Object.fromEntries(new URL(request.url).searchParams);
  const filtro = filtroMonitoramentoSchema.safeParse(consulta);
  if (!filtro.success) throw new AppError('Filtro inválido.', 400, filtro.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  return Response.json(await caixa.listar(filtro.data));
}

// GET /api/emails/:id — conversa com todas as mensagens
export async function obterConversa(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await caixa.obter(id));
}

// POST /api/emails — envia (conversa nova) ou manda lembrete (com conversaId)
export async function enviarEmail(request: Request): Promise<Response> {
  const dados = await lerCorpo(request, enviarEmailSchema);
  const resultado = await caixa.enviar(
    {
      ...dados,
      anexos: dados.anexos.map((a) => ({ nome: a.nome, conteudo: Buffer.from(a.conteudoBase64, 'base64'), mimeType: a.mimeType })),
    },
    { comentarNaTarefa: true },
  );
  // 201 = saiu; 502 = não saiu (a conversa fica registrada com o motivo, para tentar de novo)
  return Response.json(resultado, { status: resultado.enviado ? 201 : 502 });
}

// GET /api/emails/testar-conexao — login no SMTP/IMAP e pasta de Enviados (não envia nada)
export async function testarConexao(): Promise<Response> {
  return Response.json(await testarConexaoEmail());
}

// POST /api/emails/ler-caixa — lê a caixa de entrada agora (a leitura automática roda sozinha a cada EMAIL_LEITURA_MINUTOS)
export async function lerCaixaAgora(): Promise<Response> {
  return Response.json(await lerCaixa('manual'));
}

// GET /api/emails/resumo — monitoramento: situação das conversas, sem resposta, devolvidos, não vinculados, última leitura
export async function resumoCaixa(): Promise<Response> {
  return Response.json(await caixa.resumo());
}

// POST /api/emails/:id/conferir — zera as respostas novas da conversa
export async function conferirConversa(_request: Request, { params }: ComId): Promise<Response> {
  const { id } = await params;
  return Response.json(await caixa.marcarConferida(id));
}

type ComAnexo = { params: Promise<{ id: string; mensagemId: string; indice: string }> };

// GET /api/emails/:id/anexos/:mensagemId/:indice — baixa um anexo recebido
export async function baixarAnexoRecebido(_request: Request, { params }: ComAnexo): Promise<Response> {
  const { id, mensagemId, indice } = await params;
  return respostaArquivo(await caixa.obterAnexoRecebido(id, mensagemId, Number(indice)));
}

export function respostaArquivo(arquivo: { nome: string; mimeType: string; conteudo: Buffer }): Response {
  return new Response(new Uint8Array(arquivo.conteudo), {
    headers: {
      'content-type': arquivo.mimeType || 'application/octet-stream',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
    },
  });
}

import nodemailer, { type Transporter } from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import type Mail from 'nodemailer/lib/mailer';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { copiarParaEnviados, listarPastas } from './imap.integration';

export interface EmailParaEnviar {
  para: string | string[];
  cc?: string[];
  assunto: string;
  texto: string;
  html?: string;
  anexos: { nome: string; conteudo: Buffer; mimeType?: string; cid?: string }[];
  messageId?: string; // <...@dominio>; vazio = o nodemailer gera
  inReplyTo?: string; // lembrete: responde à última mensagem da conversa
  references?: string[];
  cabecalhos?: Record<string, string>;
}

export interface ResultadoEnvio {
  messageId: string;
  copiadaEnviados: boolean | null; // null = cópia desligada no .env
  avisoCopia: string | null;
}

let transporte: Transporter | null = null;

function obterTransporte(): Transporter {
  if (transporte) return transporte;
  const smtp = config.smtp;
  transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure: smtp.porta === 465,
    requireTLS: smtp.porta === 587, // na 587 só envia depois do STARTTLS (senha nunca vai aberta)
    auth: { user: smtp.usuario, pass: smtp.senha },
  });
  return transporte;
}

const lista = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

// Monta a mensagem uma vez só: o mesmo conteúdo (e o mesmo Message-ID) vai para o destinatário e para os Enviados.
export async function enviarEmailCompleto(email: EmailParaEnviar): Promise<ResultadoEnvio> {
  const smtp = config.smtp;
  const opcoes: Mail.Options = {
    from: smtp.remetente,
    to: lista(email.para),
    cc: email.cc?.length ? email.cc : undefined,
    subject: email.assunto,
    text: email.texto,
    html: email.html,
    messageId: email.messageId,
    inReplyTo: email.inReplyTo,
    references: email.references?.length ? email.references : undefined,
    headers: email.cabecalhos,
    attachments: email.anexos.map((anexo) => ({
      filename: anexo.nome,
      content: anexo.conteudo,
      contentType: anexo.mimeType ?? 'application/pdf',
      ...(anexo.cid ? { cid: anexo.cid, contentDisposition: 'inline' as const } : {}),
    })),
  };

  const no = new MailComposer(opcoes).compile();
  const messageId = no.messageId();
  const bruta = await no.build();
  const destinatarios = [...lista(email.para), ...(email.cc ?? [])];

  try {
    await obterTransporte().sendMail({ envelope: { from: smtp.usuario, to: destinatarios }, raw: bruta });
  } catch (erro) {
    throw new AppError(`Falha ao enviar o e-mail: ${(erro as Error).message}`, 502);
  }

  // O e-mail já saiu: se a cópia falhar, só avisa.
  if (!config.caixaEmail.copiarEnviados) return { messageId, copiadaEnviados: null, avisoCopia: null };
  try {
    await copiarParaEnviados(bruta);
    return { messageId, copiadaEnviados: true, avisoCopia: null };
  } catch (erro) {
    console.error('[email] cópia nos Enviados falhou', erro);
    return { messageId, copiadaEnviados: false, avisoCopia: (erro as Error).message };
  }
}

// Mantida para quem já usava: devolve só o Message-ID.
export async function enviarEmail(email: EmailParaEnviar): Promise<string> {
  return (await enviarEmailCompleto(email)).messageId;
}

// Confere login no SMTP e no IMAP e se a pasta de Enviados existe. Não envia nada.
export async function testarConexaoEmail() {
  const caixa = config.caixaEmail;
  const resultado = {
    conta: caixa.usuario,
    smtp: { ok: false, servidor: `${caixa.host}:${caixa.porta}`, erro: null as string | null },
    imap: { ok: false, servidor: `${caixa.imapHost}:${caixa.imapPorta}`, erro: null as string | null },
    pastaEnviados: { nome: caixa.pastaEnviados, existe: false },
    pastas: [] as string[],
  };

  try {
    await obterTransporte().verify();
    resultado.smtp.ok = true;
  } catch (erro) {
    resultado.smtp.erro = (erro as Error).message;
  }

  try {
    resultado.pastas = await listarPastas();
    resultado.imap.ok = true;
    resultado.pastaEnviados.existe = resultado.pastas.includes(caixa.pastaEnviados);
  } catch (erro) {
    resultado.imap.erro = (erro as Error).message;
  }

  return resultado;
}

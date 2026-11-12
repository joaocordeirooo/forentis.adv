import nodemailer from 'nodemailer';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';

export interface EmailParaEnviar {
  para: string;
  assunto: string;
  texto: string;
  anexos: { nome: string; conteudo: Buffer; mimeType?: string }[];
}

export async function enviarEmail(email: EmailParaEnviar): Promise<string> {
  const smtp = config.smtp;
  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure: smtp.porta === 465,
    auth: { user: smtp.usuario, pass: smtp.senha },
  });

  try {
    const resultado = await transporte.sendMail({
      from: smtp.remetente,
      to: email.para,
      subject: email.assunto,
      text: email.texto,
      attachments: email.anexos.map((anexo) => ({
        filename: anexo.nome,
        content: anexo.conteudo,
        contentType: anexo.mimeType ?? 'application/pdf',
      })),
    });
    return resultado.messageId;
  } catch (erro) {
    throw new AppError(`Falha ao enviar o e-mail: ${(erro as Error).message}`, 502);
  }
}

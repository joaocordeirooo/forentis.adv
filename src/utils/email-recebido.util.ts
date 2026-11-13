import type { ParsedMail } from 'mailparser';
import { PREFIXO_CODIGO_EMAIL } from '@/config/email.config';
import type { TipoRecebido } from '@/models/email.model';

// Regras para entender um e-mail recebido: devolução, resposta automática ou resposta de verdade.

const REGEX_CODIGO = new RegExp(`\\b${PREFIXO_CODIGO_EMAIL}-[A-HJ-NP-Z2-9]{6}\\b`, 'g');

export function codigosNoTexto(texto: string): string[] {
  return [...new Set(texto.toUpperCase().match(REGEX_CODIGO) ?? [])];
}

function cabecalho(email: ParsedMail, nome: string): string {
  const valor = email.headers.get(nome);
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'object' && 'value' in valor) {
    const params = 'params' in valor && valor.params ? Object.entries(valor.params).map(([k, v]) => `${k}=${v}`).join(';') : '';
    return `${String(valor.value)};${params}`;
  }
  return String(valor);
}

export function remetente(email: ParsedMail): { endereco: string; formatado: string } {
  const primeiro = email.from?.value[0];
  const endereco = (primeiro?.address ?? '').toLowerCase();
  return { endereco, formatado: primeiro?.name ? `${primeiro.name} <${endereco}>` : endereco };
}

export function enderecos(campo: ParsedMail['to']): string[] {
  const lista = Array.isArray(campo) ? campo : campo ? [campo] : [];
  return lista.flatMap((g) => g.value.map((e) => (e.address ?? '').toLowerCase())).filter(Boolean);
}

const ASSUNTO_DEVOLUCAO =
  /(undeliver|delivery status notification|returned mail|mail delivery (failed|failure|subsystem)|failure notice|delivery has failed|não (foi possível )?entreg|falha (na|de) entrega|mensagem não entregue|devolvid)/i;
const ASSUNTO_AUTOMATICO = /(resposta autom[aá]tica|automatic reply|auto[- ]?reply|autoreply|out of (the )?office|ausente|ausência|f[ée]rias)/i;

export function classificar(email: ParsedMail): TipoRecebido {
  const { endereco } = remetente(email);
  const local = endereco.split('@')[0] ?? '';
  const tipoConteudo = cabecalho(email, 'content-type').toLowerCase();
  const assunto = email.subject ?? '';

  if (
    /^(mailer-daemon|postmaster|mail-daemon)$/i.test(local) ||
    (tipoConteudo.includes('multipart/report') && tipoConteudo.includes('delivery-status')) ||
    (ASSUNTO_DEVOLUCAO.test(assunto) && !/^re:/i.test(assunto))
  ) {
    return 'devolucao';
  }

  const autoSubmitted = cabecalho(email, 'auto-submitted').toLowerCase();
  if (
    (autoSubmitted && !autoSubmitted.startsWith('no')) ||
    cabecalho(email, 'x-autoreply') ||
    cabecalho(email, 'x-autorespond') ||
    /auto_reply/i.test(cabecalho(email, 'precedence')) ||
    ASSUNTO_AUTOMATICO.test(assunto)
  ) {
    return 'automatica';
  }
  return 'resposta';
}

// Ids que a resposta cita (In-Reply-To + References), em minúsculas.
export function idsCitados(email: ParsedMail): string[] {
  const refs = Array.isArray(email.references) ? email.references : email.references ? email.references.split(/\s+/) : [];
  return [...new Set([email.inReplyTo ?? '', ...refs].map((r) => r.trim().toLowerCase()).filter(Boolean))];
}

// Corta o histórico citado ("Em ..., Fulano escreveu:", bloco "De:/Enviado:" do Outlook, linhas com ">").
const MARCAS_CITACAO = [
  /^\s*Em .{3,250}escreveu:?\s*$/im,
  /^\s*On .{3,250}wrote:?\s*$/im,
  /^\s*-{2,}\s*(Mensagem original|Original Message|Mensagem encaminhada|Forwarded message)\s*-{2,}/im,
  /^\s*\*?De:\*?\s.*\r?\n\s*\*?(Enviad[oa]|Data|Sent|Date):/im,
  /^\s*\*?From:\*?\s.*\r?\n\s*\*?(Sent|Date|Enviad[oa]|Data):/im,
  /^_{10,}\s*$/m,
];

export function extrairResposta(texto: string): string {
  const original = texto.replace(/\r\n/g, '\n').trim();
  let corte = original.length;
  for (const marca of MARCAS_CITACAO) {
    const achado = marca.exec(original);
    if (achado && achado.index < corte) corte = achado.index;
  }
  const resposta = original
    .slice(0, corte)
    .split('\n')
    .filter((linha) => !linha.trimStart().startsWith('>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return resposta || original;
}

// Motivo legível da devolução: destinatário + a linha com o código do servidor (550, 5.1.1...).
export function motivoDevolucao(email: ParsedMail, fonte: string): string {
  const destinatario = /(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*<?([^\s>]+)/i.exec(fonte)?.[1] ?? null;
  const texto = email.text ?? '';
  const linha =
    texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => /\b[45]\.\d{1,3}\.\d{1,3}\b|\b5\d\d[ -]/.test(l)) ??
    /Diagnostic-Code:\s*(.+)/i.exec(fonte)?.[1]?.trim() ??
    null;
  const partes = [destinatario, linha?.slice(0, 300)].filter(Boolean);
  return partes.length ? partes.join(': ') : 'O servidor de e-mail devolveu a mensagem (sem detalhe do motivo).';
}

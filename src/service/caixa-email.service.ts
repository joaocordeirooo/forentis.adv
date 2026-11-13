import { randomBytes, randomUUID } from 'node:crypto';
import { config } from '@/config/env.config';
import { MAX_ENVIOS_POR_CONVERSA, PREFIXO_CODIGO_EMAIL } from '@/config/email.config';
import { AppError } from '@/errors/app.errors';
import { enviarEmailCompleto } from '@/integrations/email.integration';
import { registrarComentarioTarefa } from '@/integrations/lawyertool.integration';
import type {
  ConversaEmail,
  MensagemEmail,
  PedidoEmail,
  ResultadoEnvioEmail,
  StatusConversa,
  TipoVinculo,
  VinculoEmail,
} from '@/models/email.model';
import { STATUS_CONVERSA } from '@/models/email.model';
import { lerAnexoEmail } from '@/repositories/anexo-email.repository';
import * as repositorio from '@/repositories/email.repository';
import { listarNaoVinculados } from '@/repositories/email-nao-vinculado.repository';
import { obterEstadoLeitura } from '@/repositories/leitura-caixa.repository';
import { escaparHtml, montarAssinatura, resolverAssinatura } from './assinatura-email.service';

const REGEX_EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, para não confundir

function gerarCodigo(): string {
  const bytes = randomBytes(6);
  return `${PREFIXO_CODIGO_EMAIL}-${[...bytes].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('')}`;
}

function limparEnderecos(lista: string[] | undefined): string[] {
  const enderecos = [...new Set((lista ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const invalidos = enderecos.filter((e) => !REGEX_EMAIL.test(e));
  if (invalidos.length) throw new AppError(`E-mail inválido: ${invalidos.join(', ')}`, 400);
  return enderecos;
}

function vinculoCompleto(v: PedidoEmail['vinculo']): VinculoEmail {
  return {
    tipo: v.tipo,
    solicitacaoId: v.solicitacaoId ?? null,
    tarefaId: v.tarefaId ?? null,
    processoId: v.processoId ?? null,
    empresa: v.empresa ?? null,
  };
}

// Texto digitado → HTML: linha em branco separa parágrafos; quebra simples vira <br>.
function textoParaHtml(texto: string): string {
  return texto
    .trim()
    .split(/\n\s*\n/)
    .map((paragrafo) => `<p style="margin:0 0 12px">${escaparHtml(paragrafo).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const diasDesde = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
const dataBr = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// ---------- consultas ----------

export interface FiltroConversas {
  status?: StatusConversa;
  tipo?: TipoVinculo;
  tarefaId?: number;
  solicitacaoId?: string;
  busca?: string; // código, assunto, destinatário ou empresa
  semResposta?: boolean; // enviadas há EMAIL_DIAS_SEM_RESPOSTA dias ou mais, sem resposta
  respostaNova?: boolean; // com resposta/devolução ainda não conferida
}

export async function listar(filtro: FiltroConversas = {}): Promise<ConversaEmail[]> {
  const busca = filtro.busca?.trim().toLowerCase();
  return (await repositorio.listarConversas()).filter(
    (c) =>
      (!filtro.status || c.status === filtro.status) &&
      (!filtro.tipo || c.vinculo.tipo === filtro.tipo) &&
      (!filtro.tarefaId || c.vinculo.tarefaId === filtro.tarefaId) &&
      (!filtro.solicitacaoId || c.vinculo.solicitacaoId === filtro.solicitacaoId) &&
      (!filtro.semResposta || semRespostaHa(c, config.caixaEmail.diasSemResposta)) &&
      (!filtro.respostaNova || (c.respostasNovas ?? 0) > 0) &&
      (!busca ||
        [c.codigo, c.assunto, c.vinculo.empresa ?? '', ...c.destinatarios.para].some((campo) => campo.toLowerCase().includes(busca))),
  );
}

export async function obter(id: string): Promise<ConversaEmail> {
  const conversa = await repositorio.obterConversa(id);
  if (!conversa) throw new AppError('Conversa de e-mail não encontrada.', 404);
  return conversa;
}

// ---------- envio ----------

// Acha a conversa onde o envio entra e confere as travas. null = conversa nova.
async function conversaDoEnvio(pedido: PedidoEmail): Promise<ConversaEmail | null> {
  if (pedido.conversaId) {
    const conversa = await obter(pedido.conversaId);
    if (conversa.envios >= MAX_ENVIOS_POR_CONVERSA) {
      throw new AppError(`Esta conversa já teve ${conversa.envios} envios (máximo ${MAX_ENVIOS_POR_CONVERSA}).`, 409);
    }
    const intervalo = config.automacao.diasSemRepetir;
    if (conversa.ultimoEnvioEm && diasDesde(conversa.ultimoEnvioEm) < intervalo) {
      throw new AppError(`Último envio em ${dataBr(conversa.ultimoEnvioEm)}: o próximo lembrete só depois de ${intervalo} dias.`, 409);
    }
    return conversa;
  }

  if (pedido.vinculo.solicitacaoId) {
    const existente = await repositorio.obterConversaPorSolicitacao(pedido.vinculo.solicitacaoId);
    if (existente && existente.envios > 0) {
      throw new AppError(`Esta solicitação já tem e-mail enviado (${existente.codigo}). Para cobrar, envie um lembrete na conversa.`, 409);
    }
    return existente; // só falhas antes: tenta de novo na mesma conversa
  }
  return null;
}

export async function enviar(pedido: PedidoEmail, opcoes: { comentarNaTarefa?: boolean } = {}): Promise<ResultadoEnvioEmail> {
  const caixa = config.caixaEmail;
  const auto = config.automacao;
  if (auto.modoTeste && !auto.emailTeste) throw new AppError('EMAIL_TESTE não definido no .env.', 422);

  const existente = await conversaDoEnvio(pedido);
  const para = limparEnderecos(pedido.para.length ? pedido.para : existente?.destinatarios.para);
  const cc = limparEnderecos(pedido.cc?.length ? pedido.cc : existente?.destinatarios.cc);
  if (!para.length) throw new AppError('Informe ao menos um destinatário.', 400);

  const assuntoBase = existente?.assunto ?? pedido.assunto.trim();
  if (!assuntoBase) throw new AppError('Informe o assunto do e-mail.', 400);
  if (pedido.texto.trim().length < 5) throw new AppError('Escreva o texto do e-mail.', 400);

  const anexos = pedido.anexos ?? [];
  const totalMb = anexos.reduce((soma, a) => soma + a.conteudo.length, 0) / 1024 / 1024;
  if (totalMb > caixa.maxAnexosMb) {
    throw new AppError(`Anexos somam ${totalMb.toFixed(1)} MB (máximo ${caixa.maxAnexosMb} MB).`, 422);
  }

  const agora = new Date().toISOString();
  const conversa: ConversaEmail = existente ?? {
    id: randomUUID(),
    codigo: gerarCodigo(),
    vinculo: vinculoCompleto(pedido.vinculo),
    assunto: assuntoBase,
    destinatarios: { para, cc },
    modoTeste: auto.modoTeste,
    status: 'falhou',
    envios: 0,
    mensagens: [],
    respostasNovas: 0,
    ultimoErro: null,
    ultimoEnvioEm: null,
    ultimaRespostaEm: null,
    criadaEm: agora,
    atualizadaEm: agora,
  };

  // Lembrete: responde à conversa (mesmo assunto com "Re:" e cabeçalhos de resposta → o cliente de e-mail agrupa).
  const idsAnteriores = conversa.mensagens.filter((m) => m.situacao !== 'falhou').map((m) => m.messageId);
  const ehLembrete = idsAnteriores.length > 0;
  const assunto = [
    auto.modoTeste ? '[TESTE] ' : '',
    ehLembrete && !/^re:/i.test(assuntoBase) ? 'Re: ' : '',
    `${assuntoBase} [${conversa.codigo}]`,
  ].join('');

  // Modo teste: tudo vai para o EMAIL_TESTE, sem cópia, avisando para onde iria.
  const destino = auto.modoTeste ? [auto.emailTeste] : para;
  const destinoCc = auto.modoTeste ? [] : cc;
  const corpo = auto.modoTeste
    ? `MODO TESTE — no envio real iria para: ${para.join(', ')}${cc.length ? ` (cópia: ${cc.join(', ')})` : ''}\n\n${pedido.texto.trim()}`
    : pedido.texto.trim();

  const assinatura = await montarAssinatura(await resolverAssinatura(pedido.funcionario));
  const messageId = `<${randomUUID()}@${caixa.dominio}>`;

  const mensagem: MensagemEmail = {
    id: randomUUID(),
    messageId,
    direcao: 'saida',
    situacao: 'enviada',
    de: config.smtp.usuario,
    para: destino,
    cc: destinoCc,
    assunto,
    texto: pedido.texto.trim(),
    anexos: anexos.map((a) => ({ nome: a.nome, mimeType: a.mimeType ?? 'application/pdf', tamanho: a.conteudo.length })),
    funcionario: pedido.funcionario,
    em: agora,
    erro: null,
    copiadaEnviados: null,
  };

  let motivo: string | null = null;
  try {
    const resultado = await enviarEmailCompleto({
      para: destino,
      cc: destinoCc,
      assunto,
      texto: `${corpo}\n\n-- \n${assinatura.texto}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222;line-height:1.5">${textoParaHtml(corpo)}</div>${assinatura.html}`,
      anexos: [...anexos, ...(assinatura.imagem ? [assinatura.imagem] : [])],
      messageId,
      inReplyTo: idsAnteriores.at(-1),
      references: idsAnteriores,
      cabecalhos: { 'X-Forentis-Codigo': conversa.codigo },
    });
    mensagem.copiadaEnviados = resultado.copiadaEnviados;
  } catch (erro) {
    motivo = (erro as Error).message;
    mensagem.situacao = 'falhou';
    mensagem.erro = motivo;
  }

  const enviado = mensagem.situacao === 'enviada';
  const salva = await repositorio.salvarConversa({
    ...conversa,
    destinatarios: { para, cc }, // reenvio para outro endereço (ex.: depois de devolução) passa a valer
    mensagens: [...conversa.mensagens, mensagem],
    envios: conversa.envios + (enviado ? 1 : 0),
    status: enviado ? 'enviado' : conversa.envios > 0 ? conversa.status : 'falhou',
    ultimoErro: motivo,
    ultimoEnvioEm: enviado ? agora : conversa.ultimoEnvioEm,
    atualizadaEm: agora,
  });

  if (opcoes.comentarNaTarefa && salva.vinculo.tarefaId) {
    await comentarNaTarefa(salva, mensagem).catch((erro) => console.error('[caixa-email] comentário não registrado', erro));
  }

  return { enviado, motivo, destino, conversa: salva };
}

// Registro na tarefa do Lawyertool para envios avulsos (a solicitação à empresa já comenta pelo próprio fluxo).
async function comentarNaTarefa(conversa: ConversaEmail, m: MensagemEmail): Promise<void> {
  const texto = [
    `[FORENTIS_EMAIL] ${conversa.codigo}${conversa.modoTeste ? ' MODO TESTE' : ''}`,
    m.situacao === 'enviada' ? `E-MAIL ${conversa.envios > 1 ? 'DE LEMBRETE ' : ''}ENVIADO` : 'E-MAIL NÃO ENVIADO',
    `Para: ${m.para.join(', ')}${m.cc.length ? ` (cópia: ${m.cc.join(', ')})` : ''}`,
    `Assunto: ${m.assunto}`,
    `Enviado por: ${m.funcionario ?? '—'}`,
    ...(m.erro ? [`Motivo: ${m.erro}`] : []),
    ...(m.anexos.length ? [`Anexos: ${m.anexos.map((a) => a.nome).join(', ')}`] : []),
    '',
    m.texto,
  ].join('\n');
  await registrarComentarioTarefa(conversa.vinculo.tarefaId!, texto);
}

// ---------- monitoramento (parte 2) ----------

const semRespostaHa = (c: ConversaEmail, dias: number) =>
  c.status === 'enviado' && !!c.ultimoEnvioEm && diasDesde(c.ultimoEnvioEm) >= dias;

export async function resumo() {
  const caixa = config.caixaEmail;
  const conversas = await repositorio.listarConversas();
  const naoVinculados = (await listarNaoVinculados()).filter((n) => n.situacao === 'pendente');
  const estado = await obterEstadoLeitura(caixa.pastaEntrada);
  const porStatus = Object.fromEntries(STATUS_CONVERSA.map((s) => [s, conversas.filter((c) => c.status === s).length]));
  const resumir = (c: ConversaEmail) => ({
    id: c.id,
    codigo: c.codigo,
    assunto: c.assunto,
    para: c.destinatarios.para,
    empresa: c.vinculo.empresa,
    tarefaId: c.vinculo.tarefaId,
    status: c.status,
    envios: c.envios,
    ultimoEnvioEm: c.ultimoEnvioEm,
    diasSemResposta: c.ultimoEnvioEm ? Math.floor(diasDesde(c.ultimoEnvioEm)) : null,
  });

  return {
    total: conversas.length,
    porStatus,
    comRespostaNova: conversas.filter((c) => (c.respostasNovas ?? 0) > 0).length,
    diasSemResposta: caixa.diasSemResposta,
    semResposta: conversas
      .filter((c) => semRespostaHa(c, caixa.diasSemResposta))
      .sort((a, b) => (a.ultimoEnvioEm ?? '').localeCompare(b.ultimoEnvioEm ?? ''))
      .map(resumir),
    devolvidos: conversas.filter((c) => c.status === 'devolvido').map(resumir),
    naoVinculadosPendentes: naoVinculados.length,
    leitura: {
      automatica: caixa.leituraMinutos > 0,
      intervaloMinutos: caixa.leituraMinutos,
      ultimaLeitura: estado.ultimaLeitura,
      ultimoResumo: estado.ultimoResumo,
    },
  };
}

// O funcionário viu as respostas novas da conversa.
export async function marcarConferida(id: string): Promise<ConversaEmail> {
  const conversa = await repositorio.atualizarConversa(id, (c) => ({ ...c, respostasNovas: 0, atualizadaEm: new Date().toISOString() }));
  if (!conversa) throw new AppError('Conversa de e-mail não encontrada.', 404);
  return conversa;
}

// Arquivo de um anexo recebido (para conferir e juntar na tarefa).
export async function obterAnexoRecebido(conversaId: string, mensagemId: string, indice: number) {
  const conversa = await obter(conversaId);
  const anexo = conversa.mensagens.find((m) => m.id === mensagemId)?.anexos[indice];
  if (!anexo) throw new AppError('Anexo não encontrado.', 404);
  if (!anexo.arquivo) throw new AppError('Este anexo não foi guardado (maior que o limite).', 410);
  const conteudo = await lerAnexoEmail(anexo.arquivo);
  if (!conteudo) throw new AppError('Arquivo do anexo não encontrado na pasta de dados.', 404);
  return { nome: anexo.nome, mimeType: anexo.mimeType, conteudo };
}

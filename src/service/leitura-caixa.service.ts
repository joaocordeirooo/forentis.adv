import { randomUUID } from 'node:crypto';
import { simpleParser, type ParsedMail } from 'mailparser';
import {
  DIAS_INICIAIS_LEITURA,
  LIMITE_POR_LEITURA,
  MAX_ANEXO_RECEBIDO_MB,
  MAX_DIAS_LEITURA,
  MAX_TEXTO_RECEBIDO,
} from '@/config/email.config';
import { config } from '@/config/env.config';
import { buscarMensagensNovas, type MensagemBruta } from '@/integrations/imap.integration';
import { registrarComentarioTarefa } from '@/integrations/lawyertool.integration';
import type { ResumoLeitura } from '@/models/email-recebido.model';
import type { AnexoRegistrado, ConversaEmail, MensagemEmail, TipoRecebido } from '@/models/email.model';
import { guardarAnexoEmail } from '@/repositories/anexo-email.repository';
import * as repoEmail from '@/repositories/email.repository';
import { obterEstadoLeitura, salvarEstadoLeitura } from '@/repositories/leitura-caixa.repository';
import * as repoNaoVinculado from '@/repositories/email-nao-vinculado.repository';
import {
  classificar,
  codigosNoTexto,
  enderecos,
  extrairResposta,
  idsCitados,
  motivoDevolucao,
  remetente,
} from '@/utils/email-recebido.util';

// Lê a caixa de entrada, liga cada e-mail à conversa certa e registra respostas, devoluções e anexos.
// Nada é apagado, movido ou marcado como lido no servidor: o Forentis só guarda até onde já leu (UID).

interface Contexto {
  conhecidos: Set<string>; // Message-IDs já registrados (não processa duas vezes)
  porMessageId: Map<string, string>; // Message-ID de envio → conversa
  porCodigo: Map<string, string>; // DAM-XXXXXX → conversa
  conversas: Map<string, ConversaEmail>;
}

type Resultado = 'respostas' | 'automaticas' | 'devolucoes' | 'naoVinculadas' | 'ignoradas';

let emAndamento: Promise<ResumoLeitura> | null = null;

// Duas chamadas ao mesmo tempo (agenda + botão) esperam a mesma leitura.
export function lerCaixa(origem: ResumoLeitura['origem']): Promise<ResumoLeitura> {
  emAndamento ??= executar(origem).finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

async function montarContexto(): Promise<Contexto> {
  const conversas = await repoEmail.listarConversas();
  const naoVinculados = await repoNaoVinculado.listarNaoVinculados();
  const ctx: Contexto = { conhecidos: new Set(), porMessageId: new Map(), porCodigo: new Map(), conversas: new Map() };
  for (const c of conversas) {
    ctx.conversas.set(c.id, c);
    ctx.porCodigo.set(c.codigo, c.id);
    for (const m of c.mensagens) {
      ctx.conhecidos.add(m.messageId.toLowerCase());
      if (m.direcao === 'saida') ctx.porMessageId.set(m.messageId.toLowerCase(), c.id);
    }
  }
  for (const n of naoVinculados) ctx.conhecidos.add(n.messageId.toLowerCase());
  return ctx;
}

// Primeira leitura: desde a conversa mais antiga (ou N dias), nunca além de MAX_DIAS_LEITURA.
function dataInicial(ctx: Contexto): Date {
  const dia = 86_400_000;
  const maisAntiga = Math.min(...[...ctx.conversas.values()].map((c) => Date.parse(c.criadaEm)), Date.now() - DIAS_INICIAIS_LEITURA * dia);
  return new Date(Math.max(maisAntiga, Date.now() - MAX_DIAS_LEITURA * dia) - dia);
}

async function executar(origem: ResumoLeitura['origem']): Promise<ResumoLeitura> {
  const caixa = config.caixaEmail;
  const resumo: ResumoLeitura = {
    origem,
    iniciadaEm: new Date().toISOString(),
    terminadaEm: '',
    lidas: 0,
    respostas: 0,
    automaticas: 0,
    devolucoes: 0,
    naoVinculadas: 0,
    ignoradas: 0,
    restantes: 0,
    erros: [],
  };

  const estado = await obterEstadoLeitura(caixa.pastaEntrada);
  const ctx = await montarContexto();
  let ultimoUid = estado.ultimoUid;
  let uidValidity = estado.uidValidity;

  try {
    const busca = await buscarMensagensNovas({
      pasta: caixa.pastaEntrada,
      uidValidity: estado.uidValidity,
      ultimoUid: estado.ultimoUid,
      desde: dataInicial(ctx),
      limite: LIMITE_POR_LEITURA,
    });
    if (busca.uidValidity !== estado.uidValidity) ultimoUid = 0; // recomeçou pela data
    uidValidity = busca.uidValidity;
    resumo.restantes = busca.restantes;

    for (const bruta of busca.mensagens) {
      resumo.lidas++;
      try {
        resumo[await processar(bruta, ctx)]++;
      } catch (erro) {
        // Um e-mail com problema não trava os outros; fica no resumo para conferência.
        resumo.erros.push(`UID ${bruta.uid}: ${(erro as Error).message}`);
        console.error(`[caixa] erro no e-mail UID ${bruta.uid}`, erro);
      }
      ultimoUid = Math.max(ultimoUid, bruta.uid);
    }
  } catch (erro) {
    resumo.erros.push((erro as Error).message);
  }

  resumo.terminadaEm = new Date().toISOString();
  await salvarEstadoLeitura({ ...estado, uidValidity, ultimoUid, ultimaLeitura: resumo.terminadaEm, ultimoResumo: resumo });
  if (resumo.lidas || resumo.erros.length) {
    console.log(
      `[caixa] ${resumo.lidas} lido(s): ${resumo.respostas} resposta(s), ${resumo.devolucoes} devolução(ões), ` +
        `${resumo.automaticas} automática(s), ${resumo.naoVinculadas} sem vínculo${resumo.erros.length ? `, ${resumo.erros.length} erro(s)` : ''}.`,
    );
  }
  return resumo;
}

// Acha a conversa do e-mail: cabeçalhos de resposta → código no assunto → (devolução) ids/código no texto devolvido.
function acharConversa(email: ParsedMail, tipo: TipoRecebido, fonte: string, ctx: Contexto) {
  for (const id of idsCitados(email)) {
    const conversaId = ctx.porMessageId.get(id);
    if (conversaId) return { conversaId, messageIdOriginal: id };
  }
  for (const codigo of codigosNoTexto(email.subject ?? '')) {
    const conversaId = ctx.porCodigo.get(codigo);
    if (conversaId) return { conversaId, messageIdOriginal: null };
  }
  if (tipo === 'devolucao') {
    const minusculo = fonte.toLowerCase();
    for (const [id, conversaId] of ctx.porMessageId) {
      if (minusculo.includes(id)) return { conversaId, messageIdOriginal: id };
    }
    for (const codigo of codigosNoTexto(fonte)) {
      const conversaId = ctx.porCodigo.get(codigo);
      if (conversaId) return { conversaId, messageIdOriginal: null };
    }
  }
  return null;
}

async function guardarAnexos(email: ParsedMail, pasta: string, prefixo: string): Promise<AnexoRegistrado[]> {
  const registrados: AnexoRegistrado[] = [];
  let indice = 0;
  for (const anexo of email.attachments) {
    // Imagens embutidas no corpo (logos de assinatura) não interessam.
    if (anexo.contentDisposition === 'inline' && anexo.contentType.startsWith('image/')) continue;
    // Parte técnica da devolução (cabeçalhos/status), não é documento.
    if (/^(message\/delivery-status|text\/rfc822-headers|message\/rfc822)$/i.test(anexo.contentType)) continue;
    indice++;
    const nome = anexo.filename || `anexo-${indice}`;
    const grande = anexo.size > MAX_ANEXO_RECEBIDO_MB * 1024 * 1024;
    registrados.push({
      nome,
      mimeType: anexo.contentType,
      tamanho: anexo.size,
      arquivo: grande ? null : await guardarAnexoEmail(pasta, `${prefixo}-${indice}-${nome}`, anexo.content),
    });
  }
  return registrados;
}

async function processar(bruta: MensagemBruta, ctx: Contexto): Promise<Resultado> {
  const caixa = config.caixaEmail;
  const email = await simpleParser(bruta.fonte);
  const de = remetente(email);
  const messageId = (email.messageId ?? `<uid-${bruta.uid}-sem-id@${caixa.dominio}>`).trim();

  if (ctx.conhecidos.has(messageId.toLowerCase())) return 'ignoradas'; // já registrado
  if (de.endereco === caixa.usuario.toLowerCase()) return 'ignoradas'; // a própria caixa
  ctx.conhecidos.add(messageId.toLowerCase());

  const tipo = classificar(email);
  // Onde procurar o envio original numa devolução: o e-mail bruto + as partes técnicas já decodificadas
  // (cabeçalhos devolvidos, mensagem original), que muitas vezes vêm em base64.
  const fonte = [
    bruta.fonte.toString('utf8'),
    email.text ?? '',
    ...email.attachments
      .filter((a) => /^(message\/delivery-status|text\/rfc822-headers|message\/rfc822|text\/plain)$/i.test(a.contentType) && a.size < 2_000_000)
      .map((a) => a.content.toString('utf8')),
  ].join('\n');
  const motivo = tipo === 'devolucao' ? motivoDevolucao(email, fonte) : null;
  const textoCompleto = (email.text ?? '').trim();
  const texto = (tipo === 'resposta' ? extrairResposta(textoCompleto) : textoCompleto).slice(0, MAX_TEXTO_RECEBIDO);
  const em = (email.date ?? new Date()).toISOString();
  const id = randomUUID();
  const achado = acharConversa(email, tipo, fonte, ctx);

  if (!achado) {
    await repoNaoVinculado.salvarNaoVinculado({
      id,
      messageId,
      uid: bruta.uid,
      tipo,
      de: de.formatado,
      para: enderecos(email.to),
      assunto: email.subject ?? '',
      texto: textoCompleto.slice(0, MAX_TEXTO_RECEBIDO),
      anexos: await guardarAnexos(email, 'nao-vinculados', id.slice(0, 8)),
      motivoDevolucao: motivo,
      em,
      recebidoEm: new Date().toISOString(),
      situacao: 'pendente',
      conversaId: null,
      resolvidoPor: null,
      resolvidoEm: null,
    });
    return 'naoVinculadas';
  }

  const mensagem: MensagemEmail = {
    id,
    messageId,
    direcao: 'entrada',
    situacao: 'recebida',
    tipo,
    de: de.formatado,
    para: enderecos(email.to),
    cc: enderecos(email.cc),
    assunto: email.subject ?? '',
    texto,
    anexos: await guardarAnexos(email, achado.conversaId, id.slice(0, 8)),
    funcionario: null,
    em,
    erro: motivo,
    copiadaEnviados: null,
    uid: bruta.uid,
  };

  const conversa = await registrarNaConversa(achado.conversaId, mensagem, achado.messageIdOriginal);
  if (conversa) {
    ctx.conversas.set(conversa.id, conversa);
    await comentarRecebido(conversa, mensagem);
  }
  return tipo === 'resposta' ? 'respostas' : tipo === 'automatica' ? 'automaticas' : 'devolucoes';
}

// Junta a mensagem recebida à conversa e atualiza a situação. Também usada ao vincular manualmente.
export async function registrarNaConversa(
  conversaId: string,
  mensagem: MensagemEmail,
  messageIdDevolvido: string | null = null,
): Promise<ConversaEmail | null> {
  const tipo = mensagem.tipo ?? 'resposta';
  return repoEmail.atualizarConversa(conversaId, (c) => {
    // Devolução: marca o envio que voltou (o citado, ou o último que saiu).
    const alvo =
      tipo === 'devolucao'
        ? (messageIdDevolvido ?? [...c.mensagens].reverse().find((m) => m.direcao === 'saida' && m.situacao === 'enviada')?.messageId ?? '')
        : '';
    const mensagens = c.mensagens.map((m) =>
      tipo === 'devolucao' && m.direcao === 'saida' && m.messageId.toLowerCase() === alvo.toLowerCase()
        ? { ...m, situacao: 'devolvida' as const, erro: mensagem.erro }
        : m,
    );
    return {
      ...c,
      mensagens: [...mensagens, mensagem], // ordem de chegada (a data do remetente nem sempre é confiável)
      status: tipo === 'devolucao' ? 'devolvido' : tipo === 'resposta' ? 'respondido' : c.status,
      respostasNovas: (c.respostasNovas ?? 0) + (tipo === 'automatica' ? 0 : 1),
      ultimaRespostaEm: tipo === 'resposta' ? mensagem.em : c.ultimaRespostaEm,
      ultimoErro: tipo === 'devolucao' ? mensagem.erro : c.ultimoErro,
      atualizadaEm: new Date().toISOString(),
    };
  });
}

// Avisa na tarefa do Lawyertool (resposta ou devolução; resposta automática não).
async function comentarRecebido(conversa: ConversaEmail, m: MensagemEmail): Promise<void> {
  if (!config.caixaEmail.comentarRespostas || !conversa.vinculo.tarefaId || m.tipo === 'automatica') return;
  const data = new Date(m.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const texto =
    m.tipo === 'devolucao'
      ? [
          `[FORENTIS_EMAIL] ${conversa.codigo}${conversa.modoTeste ? ' MODO TESTE' : ''}`,
          'E-MAIL DEVOLVIDO — não chegou ao destinatário',
          `Para: ${conversa.destinatarios.para.join(', ')}`,
          `Motivo: ${m.erro ?? '—'}`,
          `Em: ${data}`,
          '',
          'Conferir o endereço de e-mail e reenviar pelo Forentis.',
        ]
      : [
          `[FORENTIS_EMAIL] ${conversa.codigo}${conversa.modoTeste ? ' MODO TESTE' : ''}`,
          'RESPOSTA RECEBIDA POR E-MAIL',
          `De: ${m.de}`,
          `Em: ${data}`,
          ...(m.anexos.length ? [`Anexos: ${m.anexos.map((a) => a.nome).join(', ')}`] : ['Sem anexos.']),
          '',
          m.texto.slice(0, 1500),
          '',
          'Conferir no Forentis e juntar os documentos recebidos na tarefa.',
        ];
  await registrarComentarioTarefa(conversa.vinculo.tarefaId, texto.join('\n')).catch((erro) =>
    console.error('[caixa] comentário da resposta não registrado', erro),
  );
}

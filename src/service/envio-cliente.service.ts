import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import {
  adicionarChat,
  atualizarCampos,
  atualizarContexto,
  chatInexistente,
  consultarStatusChat,
  descreverFalha,
  executarDialogo,
} from '@/integrations/chatguru.integration';
import { listarComentariosTarefa, registrarComentarioTarefa } from '@/integrations/lawyertool.integration';
import type { Solicitacao } from '@/models/solicitacao.model';
import { esperar } from '@/utils/espera.util';
import { normalizarTelefone, varianteNove } from '@/utils/telefone.util';
import { MARCADOR, TITULO_CLIENTE } from './travas.service';

interface ResultadoWhatsApp {
  enviado: boolean;
  numero: string | null;
  motivo: string | null;
}

// Sequência do n8n (regras da "Cobrança Docs Invalidez"):
// preenche {Documentos_Pendentes} com e sem o 9 → se o chat não existe, chat_add com o diálogo
// Bloquear URA, espera e confere o status → grava TAREFA_LT/PROCESSO_LT → executa o diálogo.
async function enviarWhatsApp(solicitacao: Solicitacao, numero: string, nomeChat: string): Promise<ResultadoWhatsApp> {
  const cg = config.chatguru;
  const campos = { [cg.campoDocumentos]: solicitacao.texto };
  const falha = (motivo: string, numeroUsado: string | null = numero): ResultadoWhatsApp => ({ enviado: false, numero: numeroUsado, motivo });

  let efetivo: string | null = null;

  const tentativa = await atualizarCampos(numero, campos);
  if (tentativa.ok) efetivo = numero;
  else if (!chatInexistente(tentativa)) return falha(`Falha ao preencher {${cg.campoDocumentos}}: ${descreverFalha(tentativa)}`);

  const alternativo = varianteNove(numero);
  if (!efetivo && alternativo) {
    const tentativaAlt = await atualizarCampos(alternativo, campos);
    if (tentativaAlt.ok) efetivo = alternativo;
    else if (!chatInexistente(tentativaAlt)) return falha(`Falha ao preencher {${cg.campoDocumentos}}: ${descreverFalha(tentativaAlt)}`, alternativo);
  }

  if (!efetivo) {
    // O chat_add sempre "falha" na 1ª mensagem (regra das 24h); vale o status do cadastro.
    const adicao = await adicionarChat(numero, nomeChat, cg.textoNovoChat, cg.dialogoBloquearUra);
    const chatAddId = String(adicao.dados.chat_add_id ?? '');
    if (!chatAddId) return falha(`Chat não existia e não foi criado no ChatGuru: ${descreverFalha(adicao)}`);

    await esperar(cg.esperaNovoChatSegundos);
    const status = await consultarStatusChat(chatAddId);
    const situacao = String(status.dados.chat_add_status ?? status.dados.status ?? '').toLowerCase();
    if (situacao !== 'done') {
      return falha(`Chat não existia e não foi criado no ChatGuru (situação: ${situacao || 'desconhecida'}): ${descreverFalha(status)}`);
    }
    const informado = String(status.dados.chat_number ?? status.dados.phone_number ?? status.dados.number ?? '').replace(/\D/g, '');
    efetivo = informado || numero;

    const preenchimento = await atualizarCampos(efetivo, campos);
    if (!preenchimento.ok) return falha(`Falha ao preencher {${cg.campoDocumentos}} no chat novo: ${descreverFalha(preenchimento)}`, efetivo);
  }

  await atualizarContexto(efetivo, { TAREFA_LT: String(solicitacao.tarefaId), PROCESSO_LT: String(solicitacao.processoId) });

  const dialogo = await executarDialogo(efetivo, cg.dialogo);
  if (!dialogo.ok) return falha(`Falha ao executar o diálogo no ChatGuru: ${descreverFalha(dialogo)}`, efetivo);
  return { enviado: true, numero: efetivo, motivo: null };
}

function descrever(p: Solicitacao['pendencias'][number]): string {
  const documento = String(p.documento ?? '').trim() || '(pendência sem descrição — conferir)';
  return documento + (p.periodo ? ` — período: ${p.periodo}` : '');
}

// Comentário da tarefa no mesmo formato do n8n (alimenta as travas de repetição).
function montarComentario(s: Solicitacao, envio: ResultadoWhatsApp, funcionario: string): string {
  const cg = config.chatguru;
  const confirmacoes = s.pendencias.filter((p) => p.situacao === 'a_confirmar');
  const pedidos = s.pendencias.filter((p) => p.situacao === 'solicitar');
  const acompanhamento = s.pendencias.filter((p) => !['a_confirmar', 'solicitar'].includes(String(p.situacao)));

  const linhas = [
    `${MARCADOR} assinatura:${s.assinatura}${s.modoTeste ? ' MODO TESTE' : ''}`,
    TITULO_CLIENTE,
    ...(s.modoTeste ? ['MODO TESTE — a mensagem foi para o número de teste, não para o cliente.'] : []),
    '',
    `Cliente: ${s.clienteNome ?? 'nome não informado'}`,
    '',
    'RESUMO DA ANÁLISE',
    s.resumo.trim() || 'Resumo não informado.',
    '',
    ...(confirmacoes.length ? ['Confirmar com o cliente:', ...confirmacoes.map((p) => `- ${descrever(p)}`), ''] : []),
    ...(pedidos.length ? ['Documentos a solicitar ao cliente:', ...pedidos.map((p) => `- ${descrever(p)}`), ''] : []),
    ...(acompanhamento.length
      ? ['Conferir os registros existentes antes de repetir qualquer solicitação:', ...acompanhamento.map((p) => `- ${descrever(p)} — situação: ${p.situacao}.`), '']
      : []),
    'ENVIO PELO WHATSAPP (ChatGuru — diálogo "chamar o cliente com motivo")',
    `Situação: ${envio.enviado ? 'ENVIADO' : 'NÃO ENVIADO'}`,
    ...(envio.motivo ? [`Motivo: ${envio.motivo}`] : []),
    ...(s.modoTeste
      ? [`Número usado (teste): ${envio.numero ?? 'não informado'}`, `WhatsApp do cliente no cadastro: ${s.destinatario.telefone ?? 'não informado'}`]
      : [`Número: ${envio.numero ?? 'não informado'}`]),
    ...(s.confianca ? [`Confiança da IA: ${s.confianca}`] : []),
    `Conferido por: ${funcionario}`,
    '',
    `Texto do campo {${cg.campoDocumentos}}:`,
    s.texto,
    '',
    envio.enviado
      ? 'Acompanhar a resposta do cliente no ChatGuru e registrar o recebimento na tarefa.'
      : 'Fazer o contato com o cliente manualmente.',
  ];
  return linhas.join('\n');
}

export async function concluirSolicitacaoCliente(s: Solicitacao, funcionario: string, ignorarBloqueios: boolean) {
  const cfg = config.automacao;
  const numero = cfg.modoTeste ? normalizarTelefone(cfg.telefoneTeste) : normalizarTelefone(s.destinatario.telefone);
  if (!numero) {
    throw new AppError(
      cfg.modoTeste ? 'TELEFONE_TESTE inválido no .env.' : 'Cliente sem WhatsApp válido: informe o telefone na solicitação antes de concluir.',
      422,
    );
  }

  // Confere de novo os comentários: alguém pode ter enviado pelo n8n/Central enquanto isso.
  const comentarios = await listarComentariosTarefa(s.tarefaId);
  const jaEnviada = (comentarios.data ?? []).some((c) => String(c.conteudo ?? '').includes(`assinatura:${s.assinatura}`));
  if (jaEnviada && !ignorarBloqueios) {
    throw new AppError('Já existe na tarefa um registro com as mesmas pendências. Para enviar mesmo assim, use ignorarBloqueios.', 409);
  }

  const nome = s.destinatario.nome ?? s.clienteNome ?? 'Cliente';
  const envio = await enviarWhatsApp(s, numero, cfg.modoTeste ? `TESTE - ${nome}` : nome);

  let comentarioRegistrado = true;
  try {
    await registrarComentarioTarefa(s.tarefaId, montarComentario(s, envio, funcionario));
  } catch (erro) {
    comentarioRegistrado = false;
    console.error('[envio-cliente] comentário não registrado', erro);
  }

  return { enviado: envio.enviado, destino: envio.numero, motivo: envio.motivo, comentarioRegistrado };
}

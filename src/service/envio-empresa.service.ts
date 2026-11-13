import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { enviar as enviarPelaCaixa } from './caixa-email.service';
import { registrarComentarioTarefa } from '@/integrations/lawyertool.integration';
import type { Solicitacao } from '@/models/solicitacao.model';
import { lerAnexo } from '@/repositories/anexo.repository';
import { MARCA_COMPLETAR } from './solicitacao-empresa.service';
import { MARCADOR } from './travas.service';

function comentario(
  s: Solicitacao,
  destino: string,
  enviado: boolean,
  motivo: string | null,
  funcionario: string,
  anexos: string[],
  codigoEmail: string | null,
): string {
  return [
    `${MARCADOR} empresa:${s.empresaChave} assinatura:${s.assinatura}${s.modoTeste ? ' MODO TESTE' : ''}`,
    'SOLICITAÇÃO À EMPRESA — E-MAIL',
    ...(s.modoTeste ? ['MODO TESTE — o e-mail foi para o endereço de teste, não para a empresa.'] : []),
    '',
    `Empresa: ${s.empresa}`,
    `Para: ${destino}`,
    ...(codigoEmail ? [`Código do e-mail: ${codigoEmail} (as respostas da empresa ficam registradas no Forentis)`] : []),
    `Situação: ${enviado ? 'ENVIADO' : 'NÃO ENVIADO'}`,
    ...(motivo ? [`Motivo: ${motivo}`] : []),
    `Conferido por: ${funcionario}`,
    ...(anexos.length ? ['', 'Anexos:', ...anexos.map((a) => `- ${a}`)] : []),
    '',
    `Assunto: ${s.assunto}`,
    s.texto,
    '',
    enviado ? 'Acompanhar a resposta da empresa e registrar o recebimento na tarefa.' : 'Fazer o pedido à empresa manualmente.',
  ].join('\n');
}

export async function concluirSolicitacaoEmpresa(s: Solicitacao, funcionario: string) {
  const cfg = config.automacao;
  // Endereço real da empresa (no modo teste, a caixa troca pelo EMAIL_TESTE e avisa no corpo para onde iria).
  const paraEmpresa = s.destinatario.email || (cfg.modoTeste ? cfg.emailTeste : null);
  if (cfg.modoTeste && !cfg.emailTeste) throw new AppError('EMAIL_TESTE não definido no .env.', 422);
  if (!paraEmpresa) throw new AppError('Informe o e-mail da empresa antes de concluir.', 422);
  if (s.texto.includes(MARCA_COMPLETAR)) {
    throw new AppError('Complete a identificação do cliente no texto do e-mail antes de concluir.', 422);
  }

  const anexos: { nome: string; conteudo: Buffer; mimeType?: string }[] = [];
  for (const anexo of s.anexos.filter((a) => a.incluir)) {
    const conteudo = await lerAnexo(s.id, anexo.nomeArquivo);
    if (!conteudo) throw new AppError(`Anexo não encontrado na pasta de dados: ${anexo.nomeArquivo}`, 500);
    anexos.push({ nome: anexo.nomeArquivo, conteudo, mimeType: anexo.mimeType });
  }

  // A caixa registra a conversa, põe a assinatura do funcionário e guarda a cópia nos Enviados.
  const envio = await enviarPelaCaixa({
    para: [paraEmpresa],
    assunto: s.assunto ?? 'Solicitação de documentos',
    texto: s.texto,
    anexos,
    vinculo: { tipo: 'solicitacao_empresa', solicitacaoId: s.id, tarefaId: s.tarefaId, empresa: s.empresa },
    funcionario,
  });
  const { enviado, motivo } = envio;
  const destino = envio.destino.join(', ');

  let comentarioRegistrado = true;
  try {
    await registrarComentarioTarefa(s.tarefaId, comentario(s, destino, enviado, motivo, funcionario, anexos.map((a) => a.nome), envio.conversa.codigo));
  } catch (erro) {
    comentarioRegistrado = false;
    console.error('[envio-empresa] comentário não registrado', erro);
  }

  return { enviado, destino, motivo, comentarioRegistrado, conversaEmailId: envio.conversa.id };
}

import { AppError } from '@/errors/app.errors';
import type { EmailNaoVinculado } from '@/models/email-recebido.model';
import { lerAnexoEmail } from '@/repositories/anexo-email.repository';
import * as repoEmail from '@/repositories/email.repository';
import * as repositorio from '@/repositories/email-nao-vinculado.repository';
import { registrarNaConversa } from './leitura-caixa.service';

// E-mails que chegaram sem ligação com nenhum pedido: alguém confere e vincula ou descarta.

export async function listar(situacao: EmailNaoVinculado['situacao'] | 'todos' = 'pendente') {
  const lista = await repositorio.listarNaoVinculados();
  return situacao === 'todos' ? lista : lista.filter((e) => e.situacao === situacao);
}

async function obterPendente(id: string): Promise<EmailNaoVinculado> {
  const email = await repositorio.obterNaoVinculado(id);
  if (!email) throw new AppError('E-mail não encontrado.', 404);
  if (email.situacao !== 'pendente') throw new AppError(`Este e-mail já foi ${email.situacao}.`, 409);
  return email;
}

// Liga o e-mail a uma conversa: entra no histórico como se tivesse sido reconhecido na leitura.
export async function vincular(id: string, conversaId: string, funcionario: string) {
  const email = await obterPendente(id);
  if (!(await repoEmail.obterConversa(conversaId))) throw new AppError('Conversa de e-mail não encontrada.', 404);

  const conversa = await registrarNaConversa(conversaId, {
    id: email.id,
    messageId: email.messageId,
    direcao: 'entrada',
    situacao: 'recebida',
    tipo: email.tipo,
    de: email.de,
    para: email.para,
    cc: [],
    assunto: email.assunto,
    texto: email.texto,
    anexos: email.anexos,
    funcionario: null,
    em: email.em,
    erro: email.motivoDevolucao,
    copiadaEnviados: null,
    uid: email.uid,
  });

  await repositorio.atualizarNaoVinculado(id, (e) => ({
    ...e,
    situacao: 'vinculado',
    conversaId,
    resolvidoPor: funcionario,
    resolvidoEm: new Date().toISOString(),
  }));
  return conversa;
}

export async function descartar(id: string, funcionario: string) {
  await obterPendente(id);
  return repositorio.atualizarNaoVinculado(id, (e) => ({
    ...e,
    situacao: 'descartado',
    resolvidoPor: funcionario,
    resolvidoEm: new Date().toISOString(),
  }));
}

export async function obterAnexo(id: string, indice: number) {
  const email = await repositorio.obterNaoVinculado(id);
  const anexo = email?.anexos[indice];
  if (!anexo) throw new AppError('Anexo não encontrado.', 404);
  if (!anexo.arquivo) throw new AppError('Este anexo não foi guardado (maior que o limite).', 410);
  const conteudo = await lerAnexoEmail(anexo.arquivo);
  if (!conteudo) throw new AppError('Arquivo do anexo não encontrado na pasta de dados.', 404);
  return { nome: anexo.nome, mimeType: anexo.mimeType, conteudo };
}

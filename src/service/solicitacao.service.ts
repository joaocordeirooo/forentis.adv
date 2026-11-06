import { AppError } from '@/errors/app.errors';
import type { Solicitacao } from '@/models/solicitacao.model';
import { STATUS_ABERTOS } from '@/models/solicitacao.model';
import { lerAnexo } from '@/repositories/anexo.repository';
import {
  atualizarSolicitacao,
  listarSolicitacoes,
  obterSolicitacao,
  type FiltroSolicitacoes,
} from '@/repositories/solicitacao.repository';
import { umaLinha } from '@/utils/texto.util';
import { normalizarTelefone } from '@/utils/telefone.util';
import { config } from '@/config/env.config';
import type { ConcluirSolicitacao, DescartarSolicitacao, EditarSolicitacao } from '@/validators/solicitacao.validator';
import { concluirSolicitacaoCliente } from './envio-cliente.service';
import { concluirSolicitacaoEmpresa } from './envio-empresa.service';

const emAndamento = new Set<string>(); // evita concluir a mesma solicitação duas vezes ao mesmo tempo

export function listar(filtro: FiltroSolicitacoes) {
  return listarSolicitacoes(filtro);
}

export async function obter(id: string): Promise<Solicitacao> {
  const solicitacao = await obterSolicitacao(id);
  if (!solicitacao) throw new AppError('Solicitação não encontrada.', 404);
  return solicitacao;
}

function exigirAberta(s: Solicitacao) {
  if (!STATUS_ABERTOS.includes(s.status)) {
    throw new AppError(`A solicitação está "${s.status}" e não pode mais ser alterada.`, 409);
  }
}

// O funcionário ajusta texto, destinatário e anexos antes de concluir.
export async function editar(id: string, dados: EditarSolicitacao): Promise<Solicitacao> {
  const atual = await obter(id);
  exigirAberta(atual);

  if (dados.texto !== undefined && atual.tipo === 'cliente') {
    const texto = umaLinha(dados.texto);
    const limite = config.automacao.maxCaracteresTemplate;
    if (texto.length > limite) throw new AppError(`O texto do WhatsApp deve ter até ${limite} caracteres (tem ${texto.length}).`, 400);
    dados.texto = texto;
  }
  if (dados.destinatario?.telefone) {
    const telefone = normalizarTelefone(dados.destinatario.telefone);
    if (!telefone) throw new AppError('Telefone inválido: use DDD + número.', 400);
    dados.destinatario.telefone = telefone;
  }
  const idsAnexos = new Set(atual.anexos.map((a) => a.id));
  for (const anexo of dados.anexos ?? []) {
    if (!idsAnexos.has(anexo.id)) throw new AppError(`Anexo ${anexo.id} não pertence a esta solicitação.`, 400);
  }

  const alterados = Object.keys(dados).filter((c) => c !== 'por');
  const atualizada = await atualizarSolicitacao(id, (s) => ({
    ...s,
    texto: dados.texto ?? s.texto,
    assunto: dados.assunto ?? s.assunto,
    destinatario: { ...s.destinatario, ...dados.destinatario },
    anexos: s.anexos.map((a) => {
      const mudanca = dados.anexos?.find((m) => m.id === a.id);
      return mudanca ? { ...a, incluir: mudanca.incluir } : a;
    }),
    historico: [...s.historico, { em: new Date().toISOString(), evento: 'editada', por: dados.por, detalhe: alterados.join(', ') }],
  }));
  return atualizada!;
}

export async function descartar(id: string, dados: DescartarSolicitacao): Promise<Solicitacao> {
  const atual = await obter(id);
  exigirAberta(atual);
  const atualizada = await atualizarSolicitacao(id, (s) => ({
    ...s,
    status: 'descartada',
    historico: [...s.historico, { em: new Date().toISOString(), evento: 'descartada', por: dados.funcionario, detalhe: dados.motivo }],
  }));
  return atualizada!;
}

// O funcionário conclui: cliente → WhatsApp (ChatGuru); empresa → e-mail. Depois comenta na tarefa.
export async function concluir(id: string, dados: ConcluirSolicitacao): Promise<Solicitacao> {
  const atual = await obter(id);
  exigirAberta(atual);
  if (atual.bloqueios.length && !dados.ignorarBloqueios) {
    throw new AppError('A solicitação tem bloqueios. Confira e, para enviar mesmo assim, envie ignorarBloqueios: true.', 409, atual.bloqueios);
  }
  if (emAndamento.has(id)) throw new AppError('Esta solicitação já está sendo enviada.', 409);

  emAndamento.add(id);
  try {
    const resultado = atual.tipo === 'cliente'
      ? await concluirSolicitacaoCliente(atual, dados.funcionario, dados.ignorarBloqueios ?? false)
      : await concluirSolicitacaoEmpresa(atual, dados.funcionario);

    const agora = new Date().toISOString();
    const atualizada = await atualizarSolicitacao(id, (s) => ({
      ...s,
      status: resultado.enviado ? 'concluida' : 'falha_envio',
      conclusao: { por: dados.funcionario, em: agora, ...resultado },
      historico: [
        ...s.historico,
        {
          em: agora,
          evento: resultado.enviado ? 'enviada' : 'falha_envio',
          por: dados.funcionario,
          detalhe: resultado.motivo ?? `Para ${resultado.destino}${resultado.comentarioRegistrado ? '' : ' (comentário na tarefa NÃO registrado)'}`,
        },
      ],
    }));
    return atualizada!;
  } finally {
    emAndamento.delete(id);
  }
}

export async function baixarAnexo(id: string, anexoId: string) {
  const solicitacao = await obter(id);
  const anexo = solicitacao.anexos.find((a) => a.id === anexoId);
  if (!anexo) throw new AppError('Anexo não encontrado.', 404);
  const conteudo = await lerAnexo(id, anexo.nomeArquivo);
  if (!conteudo) throw new AppError('Arquivo do anexo não está na pasta de dados.', 404);
  return { nome: anexo.nomeArquivo, conteudo };
}

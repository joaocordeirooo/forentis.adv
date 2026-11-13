import { ImapFlow } from 'imapflow';
import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';

// Abre uma conexão IMAP com a caixa do Forentis, executa a operação e fecha.
export async function comImap<T>(operacao: (cliente: ImapFlow) => Promise<T>): Promise<T> {
  const caixa = config.caixaEmail;
  const cliente = new ImapFlow({
    host: caixa.imapHost,
    port: caixa.imapPorta,
    secure: caixa.imapPorta === 993,
    auth: { user: caixa.usuario, pass: caixa.senha },
    logger: false, // o log do imapflow é muito verboso
  });

  try {
    await cliente.connect();
  } catch (erro) {
    throw new AppError(`Não conectou ao IMAP (${caixa.imapHost}:${caixa.imapPorta}): ${(erro as Error).message}`, 502);
  }

  try {
    return await operacao(cliente);
  } finally {
    await cliente.logout().catch(() => undefined);
  }
}

// Guarda a mensagem já montada na pasta Enviados, marcada como lida.
export async function copiarParaEnviados(mensagemBruta: Buffer): Promise<void> {
  const pasta = config.caixaEmail.pastaEnviados;
  await comImap(async (cliente) => {
    const resultado = await cliente.append(pasta, mensagemBruta, ['\\Seen']);
    if (!resultado) throw new Error(`o servidor recusou a gravação na pasta ${pasta}`);
  });
}

export async function listarPastas(): Promise<string[]> {
  return comImap(async (cliente) => (await cliente.list()).map((p) => p.path));
}

export interface MensagemBruta {
  uid: number;
  fonte: Buffer;
}

export interface BuscaCaixa {
  uidValidity: string;
  mensagens: MensagemBruta[];
  restantes: number;
}

// Traz as mensagens novas da pasta, em ordem de chegada (UID).
// Mesma caixa (uidValidity igual): tudo depois do último UID lido. Senão (primeira leitura ou o servidor
// renumerou a pasta): tudo desde a data informada — repetidas são descartadas depois pelo Message-ID.
export async function buscarMensagensNovas(opcoes: {
  pasta: string;
  uidValidity: string | null;
  ultimoUid: number;
  desde: Date;
  limite: number;
}): Promise<BuscaCaixa> {
  return comImap(async (cliente) => {
    const trava = await cliente.getMailboxLock(opcoes.pasta);
    try {
      const validade = cliente.mailbox ? String(cliente.mailbox.uidValidity) : '';
      const continuar = opcoes.uidValidity === validade && opcoes.ultimoUid > 0;
      const achados = continuar
        ? await cliente.search({ uid: `${opcoes.ultimoUid + 1}:*` }, { uid: true })
        : await cliente.search({ since: opcoes.desde }, { uid: true });

      // "N:*" sempre devolve ao menos a última mensagem, mesmo já lida: filtra.
      const uids = (achados || []).filter((uid) => !continuar || uid > opcoes.ultimoUid).sort((a, b) => a - b);
      const lote = uids.slice(0, opcoes.limite);

      const mensagens: MensagemBruta[] = [];
      if (lote.length) {
        for await (const m of cliente.fetch(lote.join(','), { uid: true, source: true }, { uid: true })) {
          if (m.source) mensagens.push({ uid: m.uid, fonte: m.source });
        }
      }
      mensagens.sort((a, b) => a.uid - b.uid);
      return { uidValidity: validade, mensagens, restantes: uids.length - lote.length };
    } finally {
      trava.release();
    }
  });
}

'use client';

import { motion } from 'motion/react';
import { AlertTriangle, CheckCheck, CornerDownRight, Inbox, Loader2, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { LinkTarefaLawyertool } from '@/components/ui/link-lawyertool';
import { apiEmails } from '@/lib/api-emails';
import { dataHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { ConversaEmail, MensagemEmail } from '@/models/email.model';
import { Campo, ChipAnexo, estiloCampo, guardarFuncionario, lerFuncionario, SeloTipo } from './comum';

// Uma conversa: dados do pedido, histórico (envios, respostas, devoluções) e lembrete/reenvio.

const MAX_ENVIOS = 3; // igual ao MAX_ENVIOS_POR_CONVERSA do servidor

function Mensagem({ conversa, m }: { conversa: ConversaEmail; m: MensagemEmail }) {
  const saida = m.direcao === 'saida';
  const problema = m.situacao === 'falhou' || m.situacao === 'devolvida' || m.tipo === 'devolucao';
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cn('flex', saida ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'w-full max-w-[92%] rounded-2xl px-4 py-3 ring-1 ring-inset',
          saida ? 'rounded-tr-md bg-violet-500/10 ring-violet-500/20' : 'rounded-tl-md bg-white/[0.04] ring-white/10',
          problema && 'bg-orange-500/10 ring-orange-500/30',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
          {saida ? (
            <span className="inline-flex items-center gap-1 font-medium text-violet-200">
              <Send className="h-3.5 w-3.5" /> {m.funcionario ?? 'Forentis'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-zinc-200">
              <Inbox className="h-3.5 w-3.5" /> {m.de}
            </span>
          )}
          {m.tipo && <SeloTipo tipo={m.tipo} />}
          {m.situacao === 'falhou' && <span className="font-medium text-rose-300">não saiu</span>}
          {m.situacao === 'devolvida' && <span className="font-medium text-orange-300">devolvido pelo servidor</span>}
          <span className="ml-auto tabular-nums">{dataHora(m.em)}</span>
        </div>
        {saida && <p className="mt-1 truncate text-xs text-zinc-500">Para: {[...m.para, ...m.cc].join(', ')}</p>}
        {m.erro && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-black/30 px-2.5 py-1.5 text-xs text-orange-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {m.erro}
          </p>
        )}
        {m.texto && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{m.texto}</p>}
        {m.anexos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.anexos.map((a, i) => (
              <ChipAnexo key={i} anexo={a} url={saida ? null : apiEmails.urlAnexo(conversa.id, m.id, i)} />
            ))}
          </div>
        )}
        {saida && m.copiadaEnviados === false && <p className="mt-2 text-[11px] text-zinc-500">A cópia na pasta Enviados do servidor falhou (o e-mail saiu).</p>}
      </div>
    </motion.li>
  );
}

function textoPadraoLembrete(c: ConversaEmail): string {
  const primeiro = c.mensagens.find((m) => m.direcao === 'saida' && m.situacao !== 'falhou');
  if (!primeiro) {
    // Nunca saiu: reenviar o mesmo texto.
    return [...c.mensagens].reverse().find((m) => m.direcao === 'saida')?.texto ?? '';
  }
  const data = new Date(primeiro.em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `Prezados,\n\nReiteramos a solicitação enviada em ${data}, que ainda está pendente de retorno.\n\nFicamos no aguardo.\n\nAtenciosamente,`;
}

function Reenvio({ conversa, aoEnviar }: { conversa: ConversaEmail; aoEnviar: (c: ConversaEmail) => void }) {
  const nuncaSaiu = conversa.envios === 0;
  const devolvido = conversa.status === 'devolvido';
  const [aberto, setAberto] = useState(devolvido || nuncaSaiu);
  const [para, setPara] = useState(conversa.destinatarios.para.join(', '));
  const [texto, setTexto] = useState(() => textoPadraoLembrete(conversa));
  const [funcionario, setFuncionario] = useState(lerFuncionario);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (conversa.envios >= MAX_ENVIOS) {
    return <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">Esta conversa já teve {conversa.envios} envios (máximo {MAX_ENVIOS}). Se precisar insistir, faça o contato por outro meio.</p>;
  }

  const titulo = nuncaSaiu ? 'Tentar enviar de novo' : devolvido ? 'Reenviar para outro endereço' : 'Mandar lembrete';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setAviso(null);
    guardarFuncionario(funcionario);
    try {
      const resultado = await apiEmails.enviar({
        conversaId: conversa.id,
        para: para.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean),
        texto,
        funcionario,
      });
      aoEnviar(resultado.conversa);
      if (resultado.enviado) {
        setAberto(false);
        setTexto(textoPadraoLembrete(resultado.conversa));
      } else {
        setAviso(`Não saiu: ${resultado.motivo ?? 'erro no envio'}`);
      }
    } catch (e) {
      setErro(e as Error);
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-violet-200 ring-1 ring-white/10 transition-colors hover:bg-violet-500/10">
        <CornerDownRight className="h-4 w-4" /> {titulo}
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-sm font-medium text-zinc-100">{titulo}</p>
      {(devolvido || nuncaSaiu) && (
        <Campo rotulo="Para" dica={devolvido ? 'Corrija o endereço que voltou antes de reenviar.' : undefined}>
          <input value={para} onChange={(e) => setPara(e.target.value)} className={estiloCampo} />
        </Campo>
      )}
      <Campo rotulo="Texto" dica="A assinatura entra sozinha. Sai no mesmo fio do e-mail anterior.">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} className={cn(estiloCampo, 'resize-y leading-relaxed')} />
      </Campo>
      <Campo rotulo="Seu nome (escolhe a assinatura)">
        <input value={funcionario} onChange={(e) => setFuncionario(e.target.value)} required minLength={2} className={estiloCampo} />
      </Campo>
      <AvisoErro erro={erro} />
      {aviso && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{aviso}</p>}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setAberto(false)} className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
          Cancelar
        </button>
        <button disabled={enviando || texto.trim().length < 5 || funcionario.trim().length < 2} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
        </button>
      </div>
    </form>
  );
}

export function DetalheConversa({ conversa, aoMudar }: { conversa: ConversaEmail; aoMudar: (c: ConversaEmail) => void }) {
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const novas = conversa.respostasNovas ?? 0;

  async function conferir() {
    setConferindo(true);
    setErro(null);
    try {
      aoMudar(await apiEmails.conferir(conversa.id));
    } catch (e) {
      setErro(e as Error);
    } finally {
      setConferindo(false);
    }
  }

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm text-zinc-200">{valor}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      {novas > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm text-emerald-100">
            {novas === 1 ? '1 novidade' : `${novas} novidades`} nesta conversa. Confira e, se vieram documentos, junte na tarefa.
          </p>
          <button onClick={conferir} disabled={conferindo} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {conferindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Conferido
          </button>
        </div>
      )}
      <AvisoErro erro={erro} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-white/[0.03] p-4">
        {linha('Para', conversa.destinatarios.para.join(', '))}
        {linha('Cópia', conversa.destinatarios.cc.join(', ') || '—')}
        {linha('Empresa', conversa.vinculo.empresa ?? '—')}
        {linha('Tarefa', conversa.vinculo.tarefaId ? <LinkTarefaLawyertool tarefaId={conversa.vinculo.tarefaId} texto={`#${conversa.vinculo.tarefaId}`} /> : '—')}
        {linha('Envios', `${conversa.envios} de ${MAX_ENVIOS}`)}
        {linha('Criada', dataHora(conversa.criadaEm))}
      </dl>
      {conversa.modoTeste && <p className="text-xs text-amber-300">Modo teste: os envios foram para o e-mail de teste, não para os destinatários acima.</p>}

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Histórico</h3>
        <ul className="space-y-3">
          {conversa.mensagens.map((m) => (
            <Mensagem key={m.id} conversa={conversa} m={m} />
          ))}
        </ul>
      </section>

      <Reenvio key={`${conversa.id}-${conversa.envios}-${conversa.status}`} conversa={conversa} aoEnviar={aoMudar} />
    </div>
  );
}

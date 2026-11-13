'use client';

import { motion } from 'motion/react';
import { Inbox, Link2, Loader2, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { apiEmails } from '@/lib/api-emails';
import { dataHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { EmailNaoVinculado } from '@/models/email-recebido.model';
import type { ConversaEmail } from '@/models/email.model';
import { normalizar } from '@/utils/texto.util';
import { ChipAnexo, estiloCampo, guardarFuncionario, lerFuncionario, SeloTipo, Vazio } from './comum';

// E-mails que chegaram sem ligação com nenhum pedido: vincular à conversa certa ou descartar.

function CartaoNaoVinculado({ email, conversas, aoResolver }: { email: EmailNaoVinculado; conversas: ConversaEmail[]; aoResolver: () => void }) {
  const [expandido, setExpandido] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [busca, setBusca] = useState('');
  const [conversaId, setConversaId] = useState('');
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const [funcionario, setFuncionario] = useState(lerFuncionario);
  const [pedirNome] = useState(() => lerFuncionario().length < 2);

  const opcoes = useMemo(() => {
    const termo = normalizar(busca);
    return conversas
      .filter((c) => !termo || normalizar(`${c.codigo} ${c.assunto} ${c.vinculo.empresa ?? ''} ${c.destinatarios.para.join(' ')}`).includes(termo))
      .slice(0, 30);
  }, [conversas, busca]);

  async function executar(acao: (nome: string) => Promise<unknown>) {
    const nome = funcionario.trim();
    if (nome.length < 2) {
      setErro(new Error('Informe seu nome.'));
      return;
    }
    guardarFuncionario(nome);
    setOcupado(true);
    setErro(null);
    try {
      await acao(nome);
      aoResolver();
    } catch (e) {
      setErro(e as Error);
      setOcupado(false);
    }
  }

  return (
    <motion.article layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-100">{email.assunto || '(sem assunto)'}</p>
          <p className="truncate text-xs text-zinc-500">
            {email.de} · {dataHora(email.em)}
          </p>
        </div>
        <SeloTipo tipo={email.tipo} />
      </div>

      {email.motivoDevolucao && <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-xs text-orange-200">{email.motivoDevolucao}</p>}

      {email.texto && (
        <button onClick={() => setExpandido(!expandido)} className="block w-full text-left">
          <p className={cn('whitespace-pre-wrap break-words text-sm text-zinc-300', !expandido && 'line-clamp-4')}>{email.texto}</p>
          {email.texto.length > 280 && <span className="mt-1 block text-xs text-violet-300">{expandido ? 'Mostrar menos' : 'Mostrar tudo'}</span>}
        </button>
      )}

      {email.anexos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {email.anexos.map((a, i) => (
            <ChipAnexo key={i} anexo={a} url={apiEmails.urlAnexoNaoVinculado(email.id, i)} />
          ))}
        </div>
      )}

      {pedirNome && (vinculando || confirmarDescarte) && (
        <input value={funcionario} onChange={(e) => setFuncionario(e.target.value)} placeholder="Seu nome" className={estiloCampo} />
      )}
      <AvisoErro erro={erro} />

      {vinculando ? (
        <div className="space-y-2 rounded-xl bg-white/[0.03] p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código, assunto, empresa ou e-mail…" className={cn(estiloCampo, 'pl-9')} />
          </div>
          <select value={conversaId} onChange={(e) => setConversaId(e.target.value)} size={Math.min(6, Math.max(2, opcoes.length))} className={cn(estiloCampo, 'py-1')}>
            {opcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {c.assunto} · {c.vinculo.empresa ?? c.destinatarios.para[0]}
              </option>
            ))}
          </select>
          {!opcoes.length && <p className="text-xs text-zinc-500">Nenhuma conversa encontrada.</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setVinculando(false)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
              Cancelar
            </button>
            <button
              disabled={!conversaId || ocupado}
              onClick={() => executar((nome) => apiEmails.vincular(email.id, conversaId, nome))}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Vincular
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {confirmarDescarte ? (
            <>
              <span className="self-center text-xs text-zinc-400">Descartar este e-mail?</span>
              <button onClick={() => setConfirmarDescarte(false)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                Não
              </button>
              <button
                disabled={ocupado}
                onClick={() => executar((nome) => apiEmails.descartar(email.id, nome))}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Descartar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmarDescarte(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 ring-1 ring-white/10 hover:text-rose-300">
                <Trash2 className="h-4 w-4" /> Descartar
              </button>
              <button onClick={() => setVinculando(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-violet-200 ring-1 ring-white/10 hover:bg-violet-500/10">
                <Link2 className="h-4 w-4" /> Vincular a uma conversa
              </button>
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

export function NaoVinculados({ conversas, aoMudar }: { conversas: ConversaEmail[]; aoMudar: () => void }) {
  const { dados, erro, carregando, recarregar } = useConsulta(() => apiEmails.naoVinculados('pendente'), 60_000);

  if (carregando && !dados) return <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Esqueleto key={i} className="h-48" />)}</div>;

  return (
    <div className="space-y-4">
      <AvisoErro erro={erro} />
      {dados?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {dados.map((e) => (
            <CartaoNaoVinculado
              key={e.id}
              email={e}
              conversas={conversas}
              aoResolver={() => {
                recarregar();
                aoMudar();
              }}
            />
          ))}
        </div>
      ) : (
        <Vazio icone={Inbox} texto="Nenhum e-mail sem vínculo. Tudo o que chegou foi ligado a um pedido." />
      )}
    </div>
  );
}

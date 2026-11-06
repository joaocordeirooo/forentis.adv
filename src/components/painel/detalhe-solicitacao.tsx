'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Ban, Building2, ChevronDown, ExternalLink, FileText, Info, Loader2, MessageCircle, Save, Send, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BotaoBrilho } from '@/components/ui/botao-brilho';
import { PainelLateral } from '@/components/ui/painel-lateral';
import { Etiqueta, SeloStatus } from '@/components/ui/selo-status';
import { api } from '@/lib/api-client';
import { dataHora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Solicitacao } from '@/models/solicitacao.model';
import { PreviaEmail, PreviaWhatsApp } from './previas';

const LIMITE_WHATSAPP = 250;
const ABERTOS = ['aguardando_conferencia', 'bloqueada', 'falha_envio'];

function lerFuncionario() {
  try { return localStorage.getItem('forentis.funcionario') ?? ''; } catch { return ''; }
}
function salvarFuncionario(nome: string) {
  try { localStorage.setItem('forentis.funcionario', nome); } catch { /* sem armazenamento */ }
}

function Secao({ titulo, children, inicial = true }: { titulo: string; children: React.ReactNode; inicial?: boolean }) {
  const [aberta, setAberta] = useState(inicial);
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/40">
      <button onClick={() => setAberta(!aberta)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-200">
        {titulo}
        <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition', aberta && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function DetalheSolicitacao({ id, aoFechar, aoMudar }: { id: string | null; aoFechar: () => void; aoMudar: () => void }) {
  const [s, setS] = useState<Solicitacao | null>(null);
  const [texto, setTexto] = useState('');
  const [assunto, setAssunto] = useState('');
  const [email, setEmail] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [anexos, setAnexos] = useState<Record<string, boolean>>({});
  const [funcionario, setFuncionario] = useState('');
  const [ignorar, setIgnorar] = useState(false);
  const [confirmando, setConfirmando] = useState<'concluir' | 'descartar' | null>(null);
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    setFuncionario(lerFuncionario());
  }, []);

  useEffect(() => {
    setS(null);
    setMensagem(null);
    setConfirmando(null);
    setIgnorar(false);
    if (!id) return;
    api.solicitacao(id).then((dados) => {
      setS(dados);
      setTexto(dados.texto);
      setAssunto(dados.assunto ?? '');
      setEmail(dados.destinatario.email ?? '');
      setTelefoneCliente(dados.destinatario.telefone ?? '');
      setAnexos(Object.fromEntries(dados.anexos.map((a) => [a.id, a.incluir])));
    }).catch((e) => setMensagem({ tipo: 'erro', texto: (e as Error).message }));
  }, [id]);

  if (!id) return <PainelLateral aberto={false} aoFechar={aoFechar} titulo="">{null}</PainelLateral>;

  const cliente = s?.tipo === 'cliente';
  const aberta = s ? ABERTOS.includes(s.status) : false;
  const excedeu = cliente && texto.length > LIMITE_WHATSAPP;
  const alterado = s && (
    texto !== s.texto ||
    (!cliente && (assunto !== (s.assunto ?? '') || email !== (s.destinatario.email ?? ''))) ||
    (cliente && telefoneCliente !== (s.destinatario.telefone ?? '')) ||
    s.anexos.some((a) => anexos[a.id] !== a.incluir)
  );

  async function executar(rotulo: string, acao: () => Promise<Solicitacao>, sucesso: string) {
    if (funcionario.trim().length < 2) {
      setMensagem({ tipo: 'erro', texto: 'Informe seu nome antes.' });
      return;
    }
    salvarFuncionario(funcionario.trim());
    setOcupado(rotulo);
    setMensagem(null);
    try {
      const atualizada = await acao();
      setS(atualizada);
      setConfirmando(null);
      setMensagem({ tipo: 'ok', texto: sucesso });
      aoMudar();
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  const salvar = () =>
    executar('salvar', () => api.editar(s!.id, {
      por: funcionario.trim(),
      ...(texto !== s!.texto ? { texto } : {}),
      ...(!cliente && assunto !== (s!.assunto ?? '') ? { assunto } : {}),
      ...(!cliente && email && email !== (s!.destinatario.email ?? '') ? { destinatario: { email } } : {}),
      ...(cliente && telefoneCliente && telefoneCliente !== (s!.destinatario.telefone ?? '') ? { destinatario: { telefone: telefoneCliente } } : {}),
      ...(s!.anexos.some((a) => anexos[a.id] !== a.incluir) ? { anexos: s!.anexos.map((a) => ({ id: a.id, incluir: anexos[a.id] })) } : {}),
    }), 'Alterações salvas.');

  return (
    <PainelLateral
      aberto={Boolean(id)}
      aoFechar={aoFechar}
      titulo={
        s ? (
          <div className="flex items-center gap-3">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', cliente ? 'bg-emerald-500/15 text-emerald-300' : 'bg-indigo-500/15 text-indigo-300')}>
              {cliente ? <MessageCircle className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{cliente ? s.clienteNome : s.empresa}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <SeloStatus status={s.status} />
                <Etiqueta>Tarefa #{s.tarefaId}</Etiqueta>
                <Etiqueta>Processo {s.processoId}</Etiqueta>
              </div>
            </div>
          </div>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        )
      }
    >
      {s && (
        <div className="space-y-4 pb-44 sm:pb-28">
          {s.bloqueios.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-200"><ShieldAlert className="h-4 w-4" /> Bloqueios</p>
              <ul className="space-y-1 pl-5 text-sm text-amber-100/90">{s.bloqueios.map((b, i) => <li key={i} className="list-disc">{b}</li>)}</ul>
            </div>
          )}
          {s.avisos.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200"><Info className="h-4 w-4" /> Pontos de conferência</p>
              <ul className="space-y-1 pl-5 text-sm text-zinc-400">{s.avisos.map((a, i) => <li key={i} className="list-disc">{a}</li>)}</ul>
            </div>
          )}

          {cliente ? (
            <div className="grid gap-4 md:grid-cols-2">
              <PreviaWhatsApp nome={s.destinatario.nome ?? s.clienteNome ?? 'Cliente'} numero={telefoneCliente} texto={texto} modoTeste={s.modoTeste} />
              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-400">Texto do {'{Documentos_Pendentes}'}</label>
                <textarea
                  value={texto}
                  disabled={!aberta}
                  onChange={(e) => setTexto(e.target.value.replace(/\n/g, ' '))}
                  rows={6}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-emerald-500 disabled:opacity-60"
                />
                <p className={cn('text-right text-xs', excedeu ? 'text-rose-400' : 'text-zinc-500')}>{texto.length}/{LIMITE_WHATSAPP}</p>
                <label className="block text-xs font-medium text-zinc-400">WhatsApp do cliente</label>
                <input value={telefoneCliente} disabled={!aberta} onChange={(e) => setTelefoneCliente(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:opacity-60" />
                {s.confianca && <Etiqueta>Confiança da IA: {s.confianca}</Etiqueta>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <PreviaEmail para={s.modoTeste ? 'endereço de teste (modo teste)' : email} assunto={assunto} anexos={Object.values(anexos).filter(Boolean).length} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">E-mail da empresa</label>
                  <input value={email} disabled={!aberta} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-60" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Assunto</label>
                  <input value={assunto} disabled={!aberta} onChange={(e) => setAssunto(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-60" />
                </div>
              </div>
              <label className="block text-xs font-medium text-zinc-400">Corpo do e-mail</label>
              <textarea value={texto} disabled={!aberta} onChange={(e) => setTexto(e.target.value)} rows={14} className="w-full rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed outline-none focus:border-indigo-500 disabled:opacity-60" />
              {texto.includes('a completar na conferência') && (
                <p className="text-xs text-amber-300">Complete a identificação do cliente no texto antes de concluir.</p>
              )}
              {s.anexos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-400">Anexos recortados</p>
                  {s.anexos.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <input type="checkbox" checked={anexos[a.id] ?? false} disabled={!aberta} onChange={(e) => setAnexos({ ...anexos, [a.id]: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
                      <FileText className="h-4 w-4 text-indigo-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">{a.tipo.replace(/_/g, ' ')} · págs. {a.paginas.join(', ')}</p>
                        <p className="truncate text-xs text-zinc-500">de {a.arquivoOrigemNome}</p>
                      </div>
                      <a href={api.urlAnexo(s.id, a.id)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" title="Abrir PDF">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Secao titulo="Resumo da análise">
            <p className="text-sm leading-relaxed text-zinc-300">{s.resumo || '—'}</p>
          </Secao>

          <Secao titulo={`Pendências (${s.pendencias.length})`}>
            <ul className="space-y-3">
              {s.pendencias.map((p, i) => (
                <li key={i} className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-sm text-zinc-200">{p.documento}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Etiqueta>{p.situacao}</Etiqueta>
                    {p.periodo && <Etiqueta>{p.periodo}</Etiqueta>}
                  </div>
                  {p.fontes?.map((f, j) => (
                    <blockquote key={j} className="mt-2 border-l-2 border-violet-500/50 pl-3 text-xs italic text-zinc-400">
                      “{f.trecho}” <span className="not-italic text-zinc-600">— {f.tipo} {f.id}</span>
                    </blockquote>
                  ))}
                </li>
              ))}
            </ul>
          </Secao>

          <Secao titulo="Histórico" inicial={false}>
            <ol className="relative space-y-4 border-l border-white/10 pl-5">
              {s.historico.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-violet-400 ring-4 ring-zinc-950" />
                  <p className="text-sm text-zinc-200">{h.evento}{h.por ? ` · ${h.por}` : ''}</p>
                  <p className="text-xs text-zinc-500">{dataHora(h.em)}{h.detalhe ? ` — ${h.detalhe}` : ''}</p>
                </li>
              ))}
            </ol>
          </Secao>

          {s.conclusao && (
            <div className={cn('rounded-2xl border p-4 text-sm', s.conclusao.enviado ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100')}>
              {s.conclusao.enviado ? 'Enviada' : 'Não enviada'} por {s.conclusao.por} em {dataHora(s.conclusao.em)} para {s.conclusao.destino ?? '—'}.
              {s.conclusao.motivo && <p className="mt-1">{s.conclusao.motivo}</p>}
              {!s.conclusao.comentarioRegistrado && <p className="mt-1 text-amber-200">O comentário na tarefa não foi registrado.</p>}
            </div>
          )}
        </div>
      )}

      {/* Barra de ações fixa no rodapé do painel */}
      {s && aberta && (
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-zinc-950 px-5 py-4">
          <AnimatePresence>
            {mensagem && (
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('mb-3 rounded-lg px-3 py-2 text-sm', mensagem.tipo === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300')}>
                {mensagem.texto}
              </motion.p>
            )}
          </AnimatePresence>

          {confirmando === 'concluir' && (
            <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-zinc-300">
              {cliente ? 'Enviar o WhatsApp' : 'Enviar o e-mail'} {s.modoTeste ? <b className="text-amber-300">para o destino de TESTE</b> : <b className="text-white">para o destinatário real</b>} e registrar o comentário na tarefa #{s.tarefaId} do Lawyertool?
              {cliente && <p className="mt-1 text-xs text-zinc-500">Se o chat não existir no ChatGuru, o envio espera cerca de 1 minuto.</p>}
              {s.bloqueios.length > 0 && (
                <label className="mt-2 flex items-center gap-2 text-amber-200">
                  <input type="checkbox" checked={ignorar} onChange={(e) => setIgnorar(e.target.checked)} className="accent-amber-500" /> Conferi os bloqueios e quero enviar mesmo assim
                </label>
              )}
            </div>
          )}
          {confirmando === 'descartar' && (
            <input autoFocus placeholder="Motivo do descarte" value={motivoDescarte} onChange={(e) => setMotivoDescarte(e.target.value)} className="mb-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-rose-500" />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input placeholder="Seu nome" value={funcionario} onChange={(e) => setFuncionario(e.target.value)} className="min-w-0 flex-1 basis-40 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            {alterado && (
              <BotaoBrilho variante="neutro" onClick={salvar} desativado={Boolean(ocupado) || excedeu}>
                {ocupado === 'salvar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </BotaoBrilho>
            )}
            {confirmando === 'descartar' ? (
              <BotaoBrilho variante="perigo" desativado={Boolean(ocupado) || motivoDescarte.trim().length < 3} onClick={() => executar('descartar', () => api.descartar(s.id, funcionario.trim(), motivoDescarte.trim()), 'Solicitação descartada.')}>
                {ocupado === 'descartar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Confirmar descarte
              </BotaoBrilho>
            ) : (
              <button onClick={() => setConfirmando(confirmando ? null : 'descartar')} className="rounded-xl px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-rose-300">
                Descartar
              </button>
            )}
            {confirmando === 'concluir' ? (
              <BotaoBrilho variante="sucesso" desativado={Boolean(ocupado) || Boolean(alterado) || (s.bloqueios.length > 0 && !ignorar)} onClick={() => executar('concluir', () => api.concluir(s.id, funcionario.trim(), ignorar), cliente ? 'Mensagem processada.' : 'E-mail processado.')}>
                {ocupado === 'concluir' ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <><Send className="h-4 w-4" /> Confirmar envio</>}
              </BotaoBrilho>
            ) : (
              <BotaoBrilho variante="sucesso" desativado={Boolean(ocupado) || excedeu} onClick={() => setConfirmando('concluir')}>
                <Send className="h-4 w-4" /> Concluir
              </BotaoBrilho>
            )}
          </div>
          {alterado && confirmando === 'concluir' && <p className="mt-2 text-xs text-amber-300">Salve as alterações antes de enviar.</p>}
        </div>
      )}
    </PainelLateral>
  );
}

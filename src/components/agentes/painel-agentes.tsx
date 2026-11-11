'use client';

import { motion } from 'motion/react';
import { Bot, Clock, ExternalLink, Loader2, Pencil, Plus, Search, Trash2, UserRound, Wrench, Zap } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { PainelLateral } from '@/components/ui/painel-lateral';
import { ROTULO_PLATAFORMA_AGENTE, ROTULO_STATUS_AGENTE } from '@/config/agentes.config';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { dataHora, relativo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { PLATAFORMAS_AGENTE, STATUS_AGENTE, type Agente, type PlataformaAgente, type StatusAgente } from '@/models/agente.model';
import { normalizar } from '@/utils/texto.util';

// Estação Agentes: os agentes prontos, cadastrados à mão, com o que cada um está fazendo.

const COR_STATUS: Record<StatusAgente, { selo: string; ponto: string }> = {
  producao: { selo: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30', ponto: 'bg-emerald-400' },
  teste: { selo: 'bg-amber-500/10 text-amber-300 ring-amber-500/30', ponto: 'bg-amber-400' },
  desenvolvimento: { selo: 'bg-sky-500/10 text-sky-300 ring-sky-500/30', ponto: 'bg-sky-400' },
  pausado: { selo: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/30', ponto: 'bg-zinc-500' },
};

const CHAVE_AUTOR = 'forentis.autorAgentes';

function lerAutor(): string {
  try {
    return localStorage.getItem(CHAVE_AUTOR) ?? '';
  } catch {
    return '';
  }
}

function guardarAutor(nome: string) {
  try {
    localStorage.setItem(CHAVE_AUTOR, nome);
  } catch {
    /* sem armazenamento */
  }
}

function SeloStatus({ status }: { status: StatusAgente }) {
  const cor = COR_STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset', cor.selo)}>
      <span className="relative flex h-1.5 w-1.5">
        {status === 'producao' && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', cor.ponto)} />}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', cor.ponto)} />
      </span>
      {ROTULO_STATUS_AGENTE[status]}
    </span>
  );
}

// ---- Formulário (novo / editar) ----

interface DadosForm {
  nome: string;
  descricao: string;
  status: StatusAgente;
  plataforma: PlataformaAgente;
  setor: string;
  gatilho: string;
  responsavel: string;
  ferramentas: string;
  link: string;
  fazendoAgora: string;
}

const FORM_VAZIO: DadosForm = {
  nome: '',
  descricao: '',
  status: 'producao',
  plataforma: 'skill_claude',
  setor: '',
  gatilho: '',
  responsavel: '',
  ferramentas: '',
  link: '',
  fazendoAgora: '',
};

const estiloCampo = 'w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500';

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[11px] text-zinc-500">{dica}</span>}
    </label>
  );
}

function FormAgente({ agente, aoSalvar }: { agente: Agente | null; aoSalvar: (a: Agente) => void }) {
  const [form, setForm] = useState<DadosForm>(() =>
    agente
      ? {
          nome: agente.nome,
          descricao: agente.descricao,
          status: agente.status,
          plataforma: agente.plataforma,
          setor: agente.setor ?? '',
          gatilho: agente.gatilho ?? '',
          responsavel: agente.responsavel ?? '',
          ferramentas: agente.ferramentas.join(', '),
          link: agente.link ?? '',
          fazendoAgora: '',
        }
      : { ...FORM_VAZIO, responsavel: lerAutor() },
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const mudar = (parcial: Partial<DadosForm>) => setForm((f) => ({ ...f, ...parcial }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const dados = {
      nome: form.nome,
      descricao: form.descricao,
      status: form.status,
      plataforma: form.plataforma,
      setor: form.setor || null,
      gatilho: form.gatilho || null,
      responsavel: form.responsavel || null,
      ferramentas: form.ferramentas.split(',').map((f) => f.trim()).filter(Boolean),
      link: form.link || null,
    };
    try {
      const salvo = agente
        ? await api.editarAgente(agente.id, dados)
        : await api.criarAgente({ ...dados, fazendoAgora: form.fazendoAgora || null, autor: lerAutor() || form.responsavel || null });
      aoSalvar(salvo);
    } catch (e) {
      setErro(e as Error);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo rotulo="Nome do agente">
        <input value={form.nome} onChange={(e) => mudar({ nome: e.target.value })} className={estiloCampo} placeholder="Ex.: Triagem de publicações" required autoFocus />
      </Campo>
      <Campo rotulo="O que ele faz">
        <textarea value={form.descricao} onChange={(e) => mudar({ descricao: e.target.value })} rows={4} className={estiloCampo} placeholder="Descreva o trabalho do agente: o que lê, o que decide e o que entrega." required />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Situação">
          <select value={form.status} onChange={(e) => mudar({ status: e.target.value as StatusAgente })} className={estiloCampo}>
            {STATUS_AGENTE.map((s) => <option key={s} value={s}>{ROTULO_STATUS_AGENTE[s]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Onde roda">
          <select value={form.plataforma} onChange={(e) => mudar({ plataforma: e.target.value as PlataformaAgente })} className={estiloCampo}>
            {PLATAFORMAS_AGENTE.map((p) => <option key={p} value={p}>{ROTULO_PLATAFORMA_AGENTE[p]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Setor atendido">
          <input value={form.setor} onChange={(e) => mudar({ setor: e.target.value })} className={estiloCampo} placeholder="Ex.: Judicial" />
        </Campo>
        <Campo rotulo="Quando roda">
          <input value={form.gatilho} onChange={(e) => mudar({ gatilho: e.target.value })} className={estiloCampo} placeholder="Ex.: seg–sex às 06:30, ou manual" />
        </Campo>
        <Campo rotulo="Responsável pelo agente">
          <input value={form.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })} className={estiloCampo} placeholder="Quem cuida dele" />
        </Campo>
        <Campo rotulo="Link" dica="Skill, tarefa agendada, workflow…">
          <input value={form.link} onChange={(e) => mudar({ link: e.target.value })} className={estiloCampo} placeholder="https://" inputMode="url" />
        </Campo>
      </div>
      <Campo rotulo="Ferramentas que usa" dica="Separe por vírgula. Ex.: Lawyertool, ChatGuru, eproc">
        <input value={form.ferramentas} onChange={(e) => mudar({ ferramentas: e.target.value })} className={estiloCampo} />
      </Campo>
      {!agente && (
        <Campo rotulo="O que está fazendo agora (opcional)" dica="Vira a primeira linha do histórico do agente.">
          <textarea value={form.fazendoAgora} onChange={(e) => mudar({ fazendoAgora: e.target.value })} rows={2} className={estiloCampo} />
        </Campo>
      )}
      <AvisoErro erro={erro} />
      <button type="submit" disabled={salvando} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60">
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} {agente ? 'Salvar alterações' : 'Cadastrar agente'}
      </button>
    </form>
  );
}

// ---- Detalhe ----

function Info({ icone, rotulo, children }: { icone: ReactNode; rotulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-500">{icone} {rotulo}</p>
      <p className="mt-0.5 text-sm text-zinc-200">{children}</p>
    </div>
  );
}

function DetalheAgente({ agente, aoMudar, aoEditar, aoExcluir }: { agente: Agente; aoMudar: (a: Agente) => void; aoEditar: () => void; aoExcluir: () => void }) {
  const [texto, setTexto] = useState('');
  const [autor, setAutor] = useState(lerAutor);
  const [enviando, setEnviando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      guardarAutor(autor);
      aoMudar(await api.registrarAtualizacaoAgente(agente.id, texto, autor));
      setTexto('');
    } catch (e) {
      setErro(e as Error);
    } finally {
      setEnviando(false);
    }
  }

  async function removerAtualizacao(id: string) {
    setErro(null);
    try {
      aoMudar(await api.removerAtualizacaoAgente(agente.id, id));
    } catch (e) {
      setErro(e as Error);
    }
  }

  async function excluir() {
    setErro(null);
    try {
      await api.excluirAgente(agente.id);
      aoExcluir();
    } catch (e) {
      setErro(e as Error);
    }
  }

  return (
    <div className="space-y-6">
      <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{agente.descricao}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Info icone={<Bot className="h-3 w-3" />} rotulo="Onde roda">{ROTULO_PLATAFORMA_AGENTE[agente.plataforma]}</Info>
        <Info icone={<Zap className="h-3 w-3" />} rotulo="Quando roda">{agente.gatilho ?? '—'}</Info>
        <Info icone={<UserRound className="h-3 w-3" />} rotulo="Responsável">{agente.responsavel ?? '—'}</Info>
        <Info icone={<Wrench className="h-3 w-3" />} rotulo="Setor">{agente.setor ?? '—'}</Info>
      </div>

      {agente.ferramentas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agente.ferramentas.map((f) => <span key={f} className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-300">{f}</span>)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {agente.link && (
          <a href={agente.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-sky-200 ring-1 ring-white/10 hover:bg-sky-500/10">
            <ExternalLink className="h-4 w-4" /> Abrir
          </a>
        )}
        <button onClick={aoEditar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-200 ring-1 ring-white/10 hover:bg-white/5">
          <Pencil className="h-4 w-4" /> Editar
        </button>
        {confirmarExclusao ? (
          <span className="inline-flex items-center gap-2 text-sm text-rose-200">
            Excluir este agente?
            <button onClick={excluir} className="rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-500">Excluir</button>
            <button onClick={() => setConfirmarExclusao(false)} className="rounded-lg px-3 py-1.5 text-zinc-300 ring-1 ring-white/10 hover:bg-white/5">Cancelar</button>
          </span>
        ) : (
          <button onClick={() => setConfirmarExclusao(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-rose-300 ring-1 ring-white/10 hover:bg-rose-500/10">
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-100">O que está fazendo</h3>
        <form onSubmit={registrar} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className={estiloCampo} placeholder="Ex.: Triando as publicações de hoje do TRF4 e do TJSC." />
          <div className="flex gap-2">
            <input value={autor} onChange={(e) => setAutor(e.target.value)} className={cn(estiloCampo, 'flex-1')} placeholder="Seu nome" />
            <button type="submit" disabled={enviando || !texto.trim()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar
            </button>
          </div>
        </form>
        <AvisoErro erro={erro} />
        {agente.atualizacoes.length ? (
          <ol className="relative space-y-4 border-l border-white/10 pl-4">
            {agente.atualizacoes.map((u, i) => (
              <li key={u.id} className="group relative">
                <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950', i === 0 ? 'bg-violet-400' : 'bg-zinc-600')} />
                <p className="whitespace-pre-line text-sm text-zinc-200">{u.texto}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                  {dataHora(u.criadaEm)}{u.autor ? ` · ${u.autor}` : ''}
                  <button onClick={() => removerAtualizacao(u.id)} className="text-zinc-600 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100 focus:opacity-100" aria-label="Apagar esta atualização">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-500">Nenhuma atualização registrada ainda.</p>
        )}
      </section>
    </div>
  );
}

// ---- Cartão da lista ----

function CartaoAgente({ agente, aoAbrir }: { agente: Agente; aoAbrir: () => void }) {
  return (
    <motion.button
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={aoAbrir}
      className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/80 p-4 text-left transition-colors hover:border-white/20 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-sky-500/30 ring-1 ring-white/10">
            <Bot className="h-4 w-4 text-sky-200" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-100">{agente.nome}</p>
            <p className="truncate text-xs text-zinc-500">
              {ROTULO_PLATAFORMA_AGENTE[agente.plataforma]}
              {agente.setor ? ` · ${agente.setor}` : ''}
            </p>
          </div>
        </div>
        <SeloStatus status={agente.status} />
      </div>

      <p className="line-clamp-3 text-sm text-zinc-400">{agente.descricao}</p>

      <div className="mt-auto space-y-2">
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
            <Clock className="h-3 w-3" /> Fazendo agora
            {agente.atualizacoes[0] && <span className="normal-case tracking-normal">· {relativo(agente.atualizacoes[0].criadaEm)}</span>}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-zinc-200">{agente.fazendoAgora ?? <span className="text-zinc-500">Sem atualização</span>}</p>
        </div>
        {(agente.gatilho || agente.ferramentas.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {agente.gatilho && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-zinc-400">
                <Zap className="h-3 w-3" /> {agente.gatilho}
              </span>
            )}
            {agente.ferramentas.slice(0, 4).map((f) => <span key={f} className="rounded-md bg-white/5 px-2 py-0.5 text-zinc-400">{f}</span>)}
            {agente.ferramentas.length > 4 && <span className="text-zinc-500">+{agente.ferramentas.length - 4}</span>}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ---- Tela ----

type Painel = { modo: 'novo' } | { modo: 'ver'; id: string } | { modo: 'editar'; id: string } | null;

export function PainelAgentes() {
  const { dados, erro, carregando, recarregar } = useConsulta(api.agentes, 60_000);
  const [lista, setLista] = useState<Agente[] | null>(null);
  const [status, setStatus] = useState<StatusAgente | null>(null);
  const [busca, setBusca] = useState('');
  const [painel, setPainel] = useState<Painel>(null);

  // A lista local recebe as alterações na hora; a consulta periódica traz o que mudou em outro lugar.
  const agentes = useMemo(() => lista ?? dados ?? [], [lista, dados]);
  const [ultimaConsulta, setUltimaConsulta] = useState(dados);
  if (dados !== ultimaConsulta) {
    setUltimaConsulta(dados);
    setLista(null);
  }

  function substituir(agente: Agente) {
    setLista([agente, ...agentes.filter((a) => a.id !== agente.id)]);
  }

  const contagem = useMemo(() => {
    const c = Object.fromEntries(STATUS_AGENTE.map((s) => [s, 0])) as Record<StatusAgente, number>;
    for (const a of agentes) c[a.status]++;
    return c;
  }, [agentes]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return agentes
      .filter((a) => !status || a.status === status)
      .filter((a) => !termo || normalizar(`${a.nome} ${a.descricao} ${a.setor ?? ''} ${a.responsavel ?? ''} ${a.ferramentas.join(' ')} ${a.fazendoAgora ?? ''}`).includes(termo))
      .sort((a, b) => STATUS_AGENTE.indexOf(a.status) - STATUS_AGENTE.indexOf(b.status) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [agentes, status, busca]);

  const selecionado = painel && painel.modo !== 'novo' ? agentes.find((a) => a.id === painel.id) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Agentes</h1>
          <p className="mt-1 text-zinc-400">Os agentes prontos do escritório e o que cada um está fazendo.</p>
        </div>
        <button onClick={() => setPainel({ modo: 'novo' })} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          <Plus className="h-4 w-4" /> Novo agente
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStatus(null)} className={cn('rounded-xl px-3 py-1.5 text-sm ring-1 ring-inset', status === null ? 'bg-white/10 text-white ring-white/20' : 'text-zinc-400 ring-white/10 hover:text-zinc-200')}>
          Todos <span className="ml-1 tabular-nums text-zinc-500">{agentes.length}</span>
        </button>
        {STATUS_AGENTE.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn('inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm ring-1 ring-inset', status === s ? 'bg-white/10 text-white ring-white/20' : 'text-zinc-400 ring-white/10 hover:text-zinc-200')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', COR_STATUS[s].ponto)} />
            {ROTULO_STATUS_AGENTE[s]} <span className="tabular-nums text-zinc-500">{contagem[s]}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, setor, ferramenta…" className="w-full rounded-xl border border-white/10 bg-zinc-900/80 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500" />
        </div>
      </div>

      <AvisoErro erro={erro} />

      {carregando && !dados ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Esqueleto key={i} className="h-56" />)}</div>
      ) : visiveis.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((a) => <CartaoAgente key={a.id} agente={a} aoAbrir={() => setPainel({ modo: 'ver', id: a.id })} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
          <Bot className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">{agentes.length ? 'Nenhum agente neste filtro.' : 'Nenhum agente cadastrado ainda.'}</p>
          {!agentes.length && (
            <button onClick={() => setPainel({ modo: 'novo' })} className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-violet-200 ring-1 ring-white/10 hover:bg-violet-500/10">
              <Plus className="h-4 w-4" /> Cadastrar o primeiro
            </button>
          )}
        </div>
      )}

      <PainelLateral
        aberto={painel !== null}
        aoFechar={() => setPainel(null)}
        titulo={
          painel?.modo === 'novo' ? (
            <h2 className="text-lg font-semibold text-white">Novo agente</h2>
          ) : selecionado ? (
            <div className="space-y-1">
              <h2 className="truncate text-lg font-semibold text-white">{painel?.modo === 'editar' ? `Editar · ${selecionado.nome}` : selecionado.nome}</h2>
              <SeloStatus status={selecionado.status} />
            </div>
          ) : null
        }
      >
        {painel?.modo === 'novo' && (
          <FormAgente
            agente={null}
            aoSalvar={(a) => {
              substituir(a);
              setPainel({ modo: 'ver', id: a.id });
            }}
          />
        )}
        {painel?.modo === 'editar' && selecionado && (
          <FormAgente
            key={selecionado.id}
            agente={selecionado}
            aoSalvar={(a) => {
              substituir(a);
              setPainel({ modo: 'ver', id: a.id });
            }}
          />
        )}
        {painel?.modo === 'ver' && selecionado && (
          <DetalheAgente
            key={selecionado.id}
            agente={selecionado}
            aoMudar={substituir}
            aoEditar={() => setPainel({ modo: 'editar', id: selecionado.id })}
            aoExcluir={() => {
              setLista(agentes.filter((a) => a.id !== selecionado.id));
              setPainel(null);
              recarregar();
            }}
          />
        )}
      </PainelLateral>
    </div>
  );
}

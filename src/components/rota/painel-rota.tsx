'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Briefcase, Car, Crosshair, Fuel, Gauge, Loader2, MapPin, Plus, Radio, Trash2, Utensils, Wallet, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Contador } from '@/components/ui/contador';
import { Esqueleto } from '@/components/ui/esqueleto';
import { useConsulta } from '@/hooks/use-consulta';
import { api, type PainelRota as Painel } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const MapaRota = dynamic(() => import('./mapa-rota').then((m) => m.MapaRota), {
  ssr: false,
  loading: () => <Esqueleto className="h-full w-full rounded-none" />,
});

const CATEGORIAS: Record<string, { rotulo: string; cor: string }> = {
  alimentacao: { rotulo: 'Alimentação', cor: 'bg-amber-400' },
  combustivel: { rotulo: 'Combustível', cor: 'bg-sky-400' },
  pedagio: { rotulo: 'Pedágio', cor: 'bg-violet-400' },
  estacionamento: { rotulo: 'Estacionamento', cor: 'bg-teal-400' },
  hospedagem: { rotulo: 'Hospedagem', cor: 'bg-rose-400' },
  manutencao: { rotulo: 'Manutenção', cor: 'bg-orange-400' },
  outros: { rotulo: 'Outros', cor: 'bg-zinc-400' },
};

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const diaCurto = (data: string) => new Date(`${data}T12:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const hojeSp = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

function Indicador({ icone: Icone, cor, rotulo, valor, detalhe, alerta }: { icone: LucideIcon; cor: string; rotulo: string; valor: ReactNode; detalhe?: ReactNode; alerta?: boolean }) {
  return (
    <div className={cn('rounded-2xl border bg-zinc-900/80 p-4', alerta ? 'border-amber-500/30' : 'border-white/10')}>
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg', cor)}>
          <Icone className="h-3.5 w-3.5" />
        </span>
        {rotulo}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-white">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-zinc-500">{detalhe}</p>}
    </div>
  );
}

function Modal({ titulo, aberto, aoFechar, children }: { titulo: string; aberto: boolean; aoFechar: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {aberto && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={aoFechar} />
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-white">{titulo}</h3>
                <button onClick={aoFechar} className="rounded-lg p-1 text-zinc-400 hover:bg-white/10" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

const campo = 'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-emerald-500';

function FormDespesa({ cidadePadrao, aoSalvar }: { cidadePadrao: string; aoSalvar: (d: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ categoria: 'alimentacao', valor: '', litros: '', cidade: cidadePadrao, descricao: '', data: hojeSp() });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvando(true);
        setErro(null);
        try {
          await aoSalvar({
            categoria: f.categoria,
            valor: Number(f.valor.replace(',', '.')),
            litros: f.categoria === 'combustivel' && f.litros ? Number(f.litros.replace(',', '.')) : null,
            cidade: f.cidade || null,
            descricao: f.descricao || null,
            data: f.data,
          });
        } catch (er) {
          setErro((er as Error).message);
        } finally {
          setSalvando(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} className={campo}>
          {Object.entries(CATEGORIAS).map(([k, c]) => <option key={k} value={k}>{c.rotulo}</option>)}
        </select>
        <input required inputMode="decimal" placeholder="Valor (R$)" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} className={campo} />
      </div>
      {f.categoria === 'combustivel' && <input inputMode="decimal" placeholder="Litros abastecidos" value={f.litros} onChange={(e) => setF({ ...f, litros: e.target.value })} className={campo} />}
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Cidade" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} className={campo} />
        <input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className={campo} />
      </div>
      <input placeholder="Descrição (opcional)" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} className={campo} />
      {erro && <p className="text-xs text-rose-300">{erro}</p>}
      <button type="submit" disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Registrar gasto
      </button>
    </form>
  );
}

function FormAcao({ cidadePadrao, aoSalvar }: { cidadePadrao: string; aoSalvar: (d: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ cliente: '', cidade: cidadePadrao, tipo: '', observacao: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvando(true);
        setErro(null);
        try {
          await aoSalvar({ ...f, observacao: f.observacao || null });
        } catch (er) {
          setErro((er as Error).message);
        } finally {
          setSalvando(false);
        }
      }}
    >
      <input required placeholder="Nome do cliente" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} className={campo} />
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="Cidade" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} className={campo} />
        <input required list="tipos-acao" placeholder="Tipo de ação" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={campo} />
        <datalist id="tipos-acao">
          {['Aposentadoria por incapacidade', 'Auxílio por incapacidade', 'Aposentadoria especial', 'Aposentadoria por idade', 'Aposentadoria rural', 'BPC/LOAS', 'Pensão por morte', 'Revisão de benefício', 'Salário-maternidade'].map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>
      <textarea rows={2} placeholder="Observação (opcional)" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} className={campo} />
      {erro && <p className="text-xs text-rose-300">{erro}</p>}
      <button type="submit" disabled={salvando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Registrar ação nova
      </button>
    </form>
  );
}

export function PainelRota() {
  const atendenteId = 'teste';
  const { dados, erro, carregando, recarregar } = useConsulta(() => api.rota(atendenteId), 60_000);
  const posicaoViva = useConsulta(() => api.posicao(atendenteId), 10_000);
  const [seguir, setSeguir] = useState(false);
  const [modal, setModal] = useState<'despesa' | 'acao' | null>(null);

  if (carregando && !dados) {
    return <div className="space-y-4"><Esqueleto className="h-10 w-72" /><Esqueleto className="h-[460px]" /></div>;
  }
  if (!dados) return <AvisoErro erro={erro} />;

  const posicao = posicaoViva.dados ?? dados.posicao;
  const ind = dados.indicadores;
  const hoje = hojeSp();
  const cidadeAtual = dados.paradas.find((p) => p.noLocal)?.cidade ?? (posicao.situacao === 'parado' ? posicao.cidadeProxima ?? '' : '');
  const maiorCategoria = Math.max(1, ...Object.values(ind.gastosPorCategoria));
  const andando = posicao.situacao === 'em_movimento';

  const salvarDespesa = async (d: Record<string, unknown>) => {
    await api.registrarDespesa({ ...d, atendenteId });
    setModal(null);
    await recarregar();
  };
  const salvarAcao = async (d: Record<string, unknown>) => {
    await api.registrarAcaoNova({ ...d, atendenteId });
    setModal(null);
    await recarregar();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-medium text-emerald-300">Atendimento externo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Rota e despesas</h1>
          <p className="mt-1 text-zinc-400">{dados.atendente.nome} · semana de {diaCurto(dados.semana.inicio)} a {diaCurto(dados.semana.fim)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal('despesa')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5">
            <Plus className="h-4 w-4" /> Gasto
          </button>
          <button onClick={() => setModal('acao')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5">
            <Plus className="h-4 w-4" /> Ação nova
          </button>
        </div>
      </div>

      {dados.fonteRastreador === 'simulado' && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <Radio className="h-3.5 w-3.5 text-amber-300" /> Rastreador SIMULADO e atendente fictício: o carro anda conforme o horário do roteiro de exemplo. Quando a API do rastreador for ligada, os dados passam a ser reais.
        </p>
      )}

      {/* Mapa + situação do carro */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative isolate h-[420px] overflow-hidden rounded-2xl border border-white/10 sm:h-[480px]">
          <MapaRota dados={dados} posicao={posicao} seguir={seguir} />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2">
            <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-sm">
              <span className={cn('h-2 w-2 rounded-full', andando ? 'animate-pulse bg-sky-400' : 'bg-zinc-500')} />
              {andando ? (
                <span className="text-zinc-200"><b className="text-white">{posicao.velocidade} km/h</b> · {posicao.cidadeProxima}</span>
              ) : (
                <span className="text-zinc-200">Parado em <b className="text-white">{posicao.cidadeProxima}</b></span>
              )}
              <span className="text-xs text-zinc-500">· {hora(posicao.em)}</span>
            </div>
            <button onClick={() => setSeguir(!seguir)} className={cn('pointer-events-auto inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs', seguir ? 'border-sky-400/50 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-zinc-950/90 text-zinc-300')}>
              <Crosshair className="h-3.5 w-3.5" /> {seguir ? 'Seguindo o carro' : 'Seguir o carro'}
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 right-14 z-[500] w-fit flex flex-wrap gap-3 rounded-xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-400" /> resolvida</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-400" /> com pendência</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-violet-400" /> está lá</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-zinc-500" /> a visitar</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
          <Indicador icone={Briefcase} cor="bg-emerald-500/15 text-emerald-300" rotulo="Pastas resolvidas" valor={<><Contador valor={ind.pastasResolvidas} /><span className="text-base text-zinc-500">/{ind.pastasNasCidadesVisitadas}</span></>} detalhe={`nas cidades visitadas · ${ind.pastasSemana} na semana`} />
          <Indicador icone={Gauge} cor="bg-sky-500/15 text-sky-300" rotulo="Km rodados" valor={<><Contador valor={ind.kmSemana} /> <span className="text-base text-zinc-500">km</span></>} detalhe={`${ind.kmHoje} km hoje`} />
          <Indicador icone={AlertTriangle} cor="bg-amber-500/15 text-amber-300" rotulo="Pendências deixadas" valor={<Contador valor={ind.pendenciasDeixadas} />} detalhe="cidades já visitadas" alerta={ind.pendenciasDeixadas > 0} />
          <Indicador icone={Plus} cor="bg-violet-500/15 text-violet-300" rotulo="Ações novas" valor={<Contador valor={ind.acoesNovas} />} detalhe="contratadas na semana" />
          <Indicador icone={Wallet} cor="bg-rose-500/15 text-rose-300" rotulo="Gastos da semana" valor={reais(ind.gastosSemana)} detalhe={ind.custoPorKm ? `${reais(ind.custoPorKm)}/km em combustível` : undefined} />
          <Indicador icone={Fuel} cor="bg-teal-500/15 text-teal-300" rotulo="Consumo" valor={ind.kmPorLitro ? `${ind.kmPorLitro.toLocaleString('pt-BR')} km/L` : '—'} detalhe={ind.litros ? `${ind.litros.toLocaleString('pt-BR')} L abastecidos` : 'sem abastecimento'} />
        </div>
      </div>

      {/* Semana dia a dia */}
      <section>
        <h2 className="mb-3 font-semibold text-white">Semana</h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {dados.porDia.map((d) => {
            const passado = d.data < hoje;
            const ehHoje = d.data === hoje;
            return (
              <div key={d.data} className={cn('min-w-[180px] flex-1 rounded-2xl border p-4', ehHoje ? 'border-sky-400/40 bg-sky-500/[0.06]' : 'border-white/10 bg-zinc-900/80', !passado && !ehHoje && 'opacity-60')}>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{ehHoje ? 'Hoje' : diaCurto(d.data)}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-sm text-zinc-100"><MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> {d.cidades.join(' · ') || '—'}</p>
                <div className="mt-3 space-y-1 text-xs text-zinc-400">
                  <p><b className="text-zinc-200">{d.resolvidas}/{d.total}</b> pastas resolvidas</p>
                  <p><b className="text-zinc-200">{d.km ?? '—'}</b>{d.km !== null ? ' km' : ''}</p>
                  <p><b className="text-zinc-200">{reais(d.gastos)}</b> em gastos</p>
                  {d.pendencias > 0 && <p className="text-amber-300">{d.pendencias} pendência(s)</p>}
                  {d.acoesNovas > 0 && <p className="text-violet-300">{d.acoesNovas} ação(ões) nova(s)</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pendências */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-medium text-white"><AlertTriangle className="h-4 w-4 text-amber-300" /> Pendências deixadas</h2>
            <Link href="/atendimento" className="text-xs text-emerald-300 hover:text-emerald-200">Tarefas da semana →</Link>
          </div>
          {dados.pendencias.length ? (
            <ul className="space-y-2">
              {dados.pendencias.map((p) => (
                <li key={p.id} className="rounded-xl bg-black/30 px-3 py-2.5 text-sm">
                  <p className="text-zinc-100">{p.cliente} <span className="text-zinc-500">· {p.cidade} · {diaCurto(p.data)}</span></p>
                  <p className="text-xs text-zinc-500">{p.tipo} — {p.descricao}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-zinc-500">Nenhuma pendência nas cidades já visitadas.</p>
          )}
        </section>

        {/* Ações novas */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-medium text-white"><Briefcase className="h-4 w-4 text-violet-300" /> Ações novas contratadas</h2>
            <button onClick={() => setModal('acao')} className="text-xs text-violet-300 hover:text-violet-200">+ Registrar</button>
          </div>
          {dados.acoes.length ? (
            <ul className="space-y-2">
              {dados.acoes.map((a) => (
                <li key={a.id} className="rounded-xl bg-black/30 px-3 py-2.5 text-sm">
                  <p className="text-zinc-100">{a.cliente} <span className="text-zinc-500">· {a.cidade} · {diaCurto(a.data)}</span></p>
                  <p className="text-xs text-violet-300">{a.tipo}</p>
                  {a.observacao && <p className="text-xs text-zinc-500">{a.observacao}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-zinc-500">Nenhuma ação nova nesta semana.</p>
          )}
        </section>
      </div>

      {/* Despesas */}
      <section className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-medium text-white"><Wallet className="h-4 w-4 text-rose-300" /> Gastos da semana · {reais(ind.gastosSemana)}</h2>
          <button onClick={() => setModal('despesa')} className="text-xs text-emerald-300 hover:text-emerald-200">+ Registrar gasto</button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            {Object.entries(ind.gastosPorCategoria).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([categoria, valor]) => (
              <div key={categoria}>
                <div className="mb-1 flex justify-between text-xs"><span className="text-zinc-300">{CATEGORIAS[categoria]?.rotulo}</span><span className="tabular-nums text-zinc-400">{reais(valor)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <motion.div className={cn('h-full rounded-full', CATEGORIAS[categoria]?.cor)} initial={{ width: 0 }} animate={{ width: `${(valor / maiorCategoria) * 100}%` }} transition={{ duration: 0.8 }} />
                </div>
              </div>
            ))}
            {ind.gastosSemana === 0 && <p className="text-sm text-zinc-500">Nenhum gasto registrado.</p>}
          </div>
          <ul className="divide-y divide-white/5">
            {dados.despesas.map((d) => {
              const Icone = d.categoria === 'combustivel' ? Fuel : d.categoria === 'alimentacao' ? Utensils : Car;
              return (
                <li key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-300"><Icone className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-zinc-200">{d.descricao ?? CATEGORIAS[d.categoria]?.rotulo}{d.litros ? ` · ${d.litros.toLocaleString('pt-BR')} L` : ''}</p>
                    <p className="text-xs text-zinc-500">{diaCurto(d.data)}{d.cidade ? ` · ${d.cidade}` : ''}{d.exemplo ? ' · exemplo' : ''}</p>
                  </div>
                  <span className="tabular-nums text-zinc-100">{reais(d.valor)}</span>
                  {!d.exemplo && (
                    <button onClick={async () => { await api.apagarDespesa(atendenteId, d.id); await recarregar(); }} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-rose-300" aria-label="Apagar gasto">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <Modal titulo="Registrar gasto" aberto={modal === 'despesa'} aoFechar={() => setModal(null)}>
        <FormDespesa cidadePadrao={cidadeAtual} aoSalvar={salvarDespesa} />
      </Modal>
      <Modal titulo="Registrar ação nova" aberto={modal === 'acao'} aoFechar={() => setModal(null)}>
        <FormAcao cidadePadrao={cidadeAtual} aoSalvar={salvarAcao} />
      </Modal>
    </div>
  );
}

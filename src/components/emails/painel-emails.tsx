'use client';

import { motion } from 'motion/react';
import { AlertTriangle, Clock, Inbox, Loader2, Mail, MailWarning, PenLine, Plus, RefreshCw, Reply, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { PainelLateral } from '@/components/ui/painel-lateral';
import { useConsulta } from '@/hooks/use-consulta';
import { apiEmails } from '@/lib/api-emails';
import { relativo } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { ResumoLeitura } from '@/models/email-recebido.model';
import { STATUS_CONVERSA, type ConversaEmail, type StatusConversa } from '@/models/email.model';
import { normalizar } from '@/utils/texto.util';
import { Assinaturas } from './assinaturas';
import { ROTULO_STATUS_CONVERSA, SeloConversa } from './comum';
import { DetalheConversa } from './detalhe-conversa';
import { ListaConversas } from './lista-conversas';
import { NaoVinculados } from './nao-vinculados';
import { NovoEmail } from './novo-email';

// Estação E-mails: monitoramento da caixa de solicitações, conversas, e-mails sem vínculo e assinaturas.

type Aba = 'conversas' | 'nao-vinculados' | 'assinaturas';
type Filtro = { tipo: 'todos' } | { tipo: 'status'; status: StatusConversa } | { tipo: 'respostaNova' } | { tipo: 'semResposta' };
type Painel = { modo: 'conversa'; id: string } | { modo: 'novo' } | null;

const DIA = 86_400_000;

function Indicador({
  rotulo,
  valor,
  icone: Icone,
  cor,
  ativo,
  destaque,
  aoClicar,
}: {
  rotulo: string;
  valor: number | undefined;
  icone: React.ComponentType<{ className?: string }>;
  cor: string;
  ativo: boolean;
  destaque?: boolean;
  aoClicar: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={aoClicar}
      className={cn(
        'relative flex flex-col gap-2 overflow-hidden rounded-2xl border bg-zinc-950/60 p-4 text-left transition-colors',
        ativo ? 'border-white/25 bg-white/[0.05]' : 'border-white/10 hover:border-white/20',
      )}
    >
      <span className={cn('grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset', cor)}>
        <Icone className="h-4 w-4" />
      </span>
      <span className="text-2xl font-semibold tabular-nums text-white">{valor ?? '—'}</span>
      <span className="text-xs text-zinc-400">{rotulo}</span>
      {destaque && (valor ?? 0) > 0 && <span className="absolute right-3 top-3 h-2 w-2 animate-pulse-soft rounded-full bg-emerald-400" />}
    </motion.button>
  );
}

function textoLeitura(r: ResumoLeitura): string {
  if (!r.lidas) return 'nenhum e-mail novo';
  const partes = [
    r.respostas && `${r.respostas} resposta(s)`,
    r.devolucoes && `${r.devolucoes} devolução(ões)`,
    r.automaticas && `${r.automaticas} automática(s)`,
    r.naoVinculadas && `${r.naoVinculadas} sem vínculo`,
  ].filter(Boolean);
  return `${r.lidas} lido(s)${partes.length ? `: ${partes.join(', ')}` : ''}`;
}

export function PainelEmails() {
  const resumo = useConsulta(apiEmails.resumo, 60_000);
  const lista = useConsulta(() => apiEmails.conversas(), 60_000);
  const [locais, setLocais] = useState<Record<string, ConversaEmail>>({}); // alterações feitas aqui, antes da próxima consulta
  const [aba, setAba] = useState<Aba>('conversas');
  const [filtro, setFiltro] = useState<Filtro>({ tipo: 'todos' });
  const [busca, setBusca] = useState('');
  const [painel, setPainel] = useState<Painel>(null);
  const [lendo, setLendo] = useState(false);
  const [ultimaManual, setUltimaManual] = useState<ResumoLeitura | null>(null);
  const [erroLeitura, setErroLeitura] = useState<Error | null>(null);

  const [ultimaLista, setUltimaLista] = useState(lista.dados);
  if (lista.dados !== ultimaLista) {
    setUltimaLista(lista.dados);
    setLocais({});
  }

  const conversas = useMemo(() => {
    const base = lista.dados ?? [];
    const ids = new Set(base.map((c) => c.id));
    const novas = Object.values(locais).filter((c) => !ids.has(c.id));
    return [...novas, ...base.map((c) => locais[c.id] ?? c)];
  }, [lista.dados, locais]);

  const dias = resumo.dados?.diasSemResposta ?? 7;
  const semResposta = (c: ConversaEmail) => c.status === 'enviado' && !!c.ultimoEnvioEm && Date.now() - Date.parse(c.ultimoEnvioEm) >= dias * DIA;

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return conversas
      .filter((c) => {
        if (filtro.tipo === 'status') return c.status === filtro.status;
        if (filtro.tipo === 'respostaNova') return (c.respostasNovas ?? 0) > 0;
        if (filtro.tipo === 'semResposta') return semResposta(c);
        return true;
      })
      .filter((c) => !termo || normalizar(`${c.codigo} ${c.assunto} ${c.vinculo.empresa ?? ''} ${c.destinatarios.para.join(' ')} ${c.vinculo.tarefaId ?? ''}`).includes(termo))
      .sort((a, b) => (b.respostasNovas ?? 0) - (a.respostasNovas ?? 0) || b.atualizadaEm.localeCompare(a.atualizadaEm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, filtro, busca, dias]);

  const contagem = useMemo(() => {
    const c = Object.fromEntries(STATUS_CONVERSA.map((s) => [s, 0])) as Record<StatusConversa, number>;
    for (const conversa of conversas) c[conversa.status]++;
    return c;
  }, [conversas]);

  function atualizarConversa(c: ConversaEmail) {
    setLocais((l) => ({ ...l, [c.id]: c }));
    resumo.recarregar();
  }

  async function lerAgora() {
    setLendo(true);
    setErroLeitura(null);
    try {
      setUltimaManual(await apiEmails.lerCaixa());
      await Promise.all([lista.recarregar(), resumo.recarregar()]);
    } catch (e) {
      setErroLeitura(e as Error);
    } finally {
      setLendo(false);
    }
  }

  const escolher = (f: Filtro) => {
    setAba('conversas');
    setFiltro((atual) => (JSON.stringify(atual) === JSON.stringify(f) ? { tipo: 'todos' } : f));
  };
  const ativo = (f: Filtro) => aba === 'conversas' && JSON.stringify(filtro) === JSON.stringify(f);

  const leitura = resumo.dados?.leitura;
  const ultimoResumo = ultimaManual ?? leitura?.ultimoResumo ?? null;
  const selecionada = painel?.modo === 'conversa' ? conversas.find((c) => c.id === painel.id) ?? null : null;
  const pendentesNv = resumo.dados?.naoVinculadosPendentes ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">E-mails</h1>
          <p className="mt-1 text-zinc-400">Pedidos enviados pela caixa de solicitações, respostas recebidas e o que está parado.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={lerAgora} disabled={lendo} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-zinc-200 ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-60">
            {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Ler caixa agora
          </button>
          <button onClick={() => setPainel({ modo: 'novo' })} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
            <Plus className="h-4 w-4" /> Novo e-mail
          </button>
        </div>
      </div>

      {/* Situação da leitura da caixa */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {leitura?.ultimaLeitura ? `Caixa lida ${relativo(leitura.ultimaLeitura)}` : 'Caixa ainda não lida'}
          {ultimoResumo && ` · ${textoLeitura(ultimoResumo)}`}
        </span>
        <span>{leitura ? (leitura.automatica ? `leitura automática a cada ${leitura.intervaloMinutos} min` : 'leitura automática desligada') : ''}</span>
        {ultimoResumo?.restantes ? <span className="text-amber-300">{ultimoResumo.restantes} e-mail(s) ficaram para a próxima leitura</span> : null}
      </div>
      {ultimoResumo && ultimoResumo.erros.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>A última leitura teve problema:</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-200/80">
              {ultimoResumo.erros.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <AvisoErro erro={erroLeitura ?? resumo.erro} />

      {/* Indicadores (clicáveis = filtram a lista) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Indicador rotulo="Com resposta nova" valor={resumo.dados?.comRespostaNova} icone={Reply} cor="bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" destaque ativo={ativo({ tipo: 'respostaNova' })} aoClicar={() => escolher({ tipo: 'respostaNova' })} />
        <Indicador rotulo="Aguardando resposta" valor={resumo.dados?.porStatus.enviado} icone={Send} cor="bg-sky-500/10 text-sky-300 ring-sky-500/30" ativo={ativo({ tipo: 'status', status: 'enviado' })} aoClicar={() => escolher({ tipo: 'status', status: 'enviado' })} />
        <Indicador rotulo={`Sem resposta há ${dias}+ dias`} valor={resumo.dados?.semResposta.length} icone={Clock} cor="bg-amber-500/10 text-amber-300 ring-amber-500/30" ativo={ativo({ tipo: 'semResposta' })} aoClicar={() => escolher({ tipo: 'semResposta' })} />
        <Indicador rotulo="Devolvidos" valor={resumo.dados?.porStatus.devolvido} icone={MailWarning} cor="bg-orange-500/10 text-orange-300 ring-orange-500/30" ativo={ativo({ tipo: 'status', status: 'devolvido' })} aoClicar={() => escolher({ tipo: 'status', status: 'devolvido' })} />
        <Indicador rotulo="Sem vínculo" valor={resumo.dados?.naoVinculadosPendentes} icone={Inbox} cor="bg-violet-500/10 text-violet-300 ring-violet-500/30" ativo={aba === 'nao-vinculados'} aoClicar={() => setAba('nao-vinculados')} />
      </div>

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/10">
        {(
          [
            ['conversas', 'Conversas', Mail, conversas.length],
            ['nao-vinculados', 'Sem vínculo', Inbox, pendentesNv],
            ['assinaturas', 'Assinaturas e conexão', PenLine, null],
          ] as const
        ).map(([id, rotulo, Icone, n]) => (
          <button key={id} onClick={() => setAba(id)} className={cn('relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm transition-colors', aba === id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200')}>
            <Icone className="h-4 w-4" /> {rotulo}
            {n !== null && n > 0 && <span className="rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums text-zinc-300">{n}</span>}
            {aba === id && <motion.span layoutId="aba-emails" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-400" />}
          </button>
        ))}
      </div>

      {aba === 'conversas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFiltro({ tipo: 'todos' })} className={cn('rounded-xl px-3 py-1.5 text-sm ring-1 ring-inset', filtro.tipo === 'todos' ? 'bg-white/10 text-white ring-white/20' : 'text-zinc-400 ring-white/10 hover:text-zinc-200')}>
              Todas <span className="ml-1 tabular-nums text-zinc-500">{conversas.length}</span>
            </button>
            {STATUS_CONVERSA.map((s) => (
              <button key={s} onClick={() => setFiltro({ tipo: 'status', status: s })} className={cn('rounded-xl px-1.5 py-1 ring-1 ring-inset', ativo({ tipo: 'status', status: s }) ? 'bg-white/10 ring-white/20' : 'ring-transparent hover:ring-white/10')}>
                <SeloConversa status={s} className="pointer-events-none" />
                <span className="ml-1 mr-1 text-xs tabular-nums text-zinc-500">{contagem[s]}</span>
              </button>
            ))}
            {filtro.tipo === 'respostaNova' && <span className="rounded-xl bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">Com resposta nova</span>}
            {filtro.tipo === 'semResposta' && <span className="rounded-xl bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200">Sem resposta há {dias}+ dias</span>}
            <div className="relative ml-auto w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código, assunto, empresa, e-mail, tarefa…" className="w-full rounded-xl border border-white/10 bg-zinc-900/80 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500" />
            </div>
          </div>
          <AvisoErro erro={lista.erro} />
          {lista.carregando && !lista.dados ? (
            <Esqueleto className="h-72" />
          ) : (
            <ListaConversas conversas={visiveis} aoAbrir={(id) => setPainel({ modo: 'conversa', id })} temFiltro={filtro.tipo !== 'todos' || Boolean(busca)} />
          )}
        </div>
      )}

      {aba === 'nao-vinculados' && (
        <NaoVinculados
          conversas={conversas}
          aoMudar={() => {
            lista.recarregar();
            resumo.recarregar();
          }}
        />
      )}

      {aba === 'assinaturas' && <Assinaturas />}

      <PainelLateral
        aberto={painel !== null}
        aoFechar={() => setPainel(null)}
        titulo={
          painel?.modo === 'novo' ? (
            <h2 className="text-lg font-semibold text-white">Novo e-mail</h2>
          ) : selecionada ? (
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold leading-snug text-white">{selecionada.assunto}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">{selecionada.codigo}</span>
                <SeloConversa status={selecionada.status} />
                <span className="text-xs text-zinc-500">{ROTULO_STATUS_CONVERSA[selecionada.status] === 'Aguardando resposta' && selecionada.ultimoEnvioEm ? `último envio ${relativo(selecionada.ultimoEnvioEm)}` : ''}</span>
              </div>
            </div>
          ) : null
        }
      >
        {painel?.modo === 'novo' && (
          <NovoEmail
            aoEnviar={(c) => {
              atualizarConversa(c);
              setPainel({ modo: 'conversa', id: c.id });
            }}
          />
        )}
        {painel?.modo === 'conversa' && selecionada && <DetalheConversa key={selecionada.id} conversa={selecionada} aoMudar={atualizarConversa} />}
      </PainelLateral>
    </div>
  );
}

'use client';

import { LayoutGroup, motion } from 'motion/react';
import { Filter, FilterX, Minus, Plus, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Campo, estiloCampo, IntervaloDatas, SeletorMultiplo } from '@/components/ui/campos-filtro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { Paginacao } from '@/components/ui/paginacao';
import { useConsulta } from '@/hooks/use-consulta';
import { api } from '@/lib/api-client';
import { ROTULO_STATUS } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { Solicitacao, StatusSolicitacao, TipoSolicitacao } from '@/models/solicitacao.model';
import { normalizar } from '@/utils/texto.util';
import { CartaoSolicitacao } from './cartao-solicitacao';
import { DetalheSolicitacao } from './detalhe-solicitacao';
import { VISUAL_TIPO } from './tipo-solicitacao';

// Filtro feito aqui na tela (a lista de solicitações já vem inteira da API), no mesmo padrão da aba Tarefas.

interface EstadoFiltro {
  setor: string; // id do setor, 'sem' ou '' (todos)
  fluxo: string;
  responsavel: string;
  pedidoPor: string; // quem mandou a IA executar ('' = todos, SEM = execução sem nome)
  status: StatusSolicitacao[];
  tipos: TipoSolicitacao[];
  criadaDe: string;
  criadaAte: string;
  concluidaDe: string;
  concluidaAte: string;
  busca: string;
}

const ABERTOS: StatusSolicitacao[] = ['aguardando_conferencia', 'bloqueada', 'falha_envio'];
const PADRAO: EstadoFiltro = { setor: '', fluxo: '', responsavel: '', pedidoPor: '', status: ABERTOS, tipos: [], criadaDe: '', criadaAte: '', concluidaDe: '', concluidaAte: '', busca: '' };
const CHAVE_STORAGE = 'forentis.filtroSolicitacoes';
const CHAVE_POR_PAGINA = 'forentis.solicitacoesPorPagina';
const TAMANHOS_PAGINA = [12, 24, 48] as const;
const SEM = 'sem';

// Atalhos de situação (preenchem o campo "Situação").
const ATALHOS: { chave: string; rotulo: string; status: StatusSolicitacao[] }[] = [
  { chave: 'conferir', rotulo: 'Para conferir', status: ABERTOS },
  { chave: 'bloqueadas', rotulo: 'Bloqueadas', status: ['bloqueada'] },
  { chave: 'concluidas', rotulo: 'Concluídas', status: ['concluida'] },
  { chave: 'arquivadas', rotulo: 'Descartadas', status: ['descartada', 'substituida'] },
  { chave: 'todas', rotulo: 'Todas', status: [] },
];

const mesmoConjunto = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));

function lerSalvo(): EstadoFiltro {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    return bruto ? { ...PADRAO, ...JSON.parse(bruto) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

function lerPorPagina(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE_POR_PAGINA));
    return (TAMANHOS_PAGINA as readonly number[]).includes(n) ? n : 12;
  } catch {
    return 12;
  }
}

function guardar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: só não fica lembrado */
  }
}

// Data local AAAA-MM-DD (para comparar com os campos de data).
const dia = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE') : '');
const dentro = (valor: string, de: string, ate: string) => (!de || (valor && valor >= de)) && (!ate || (valor && valor <= ate));
const chaveSetor = (s: Solicitacao) => (s.origem?.setor ? String(s.origem.setor.id) : SEM);
const contar = (lista: Solicitacao[], chave: (s: Solicitacao) => string) => {
  const mapa = new Map<string, number>();
  for (const s of lista) mapa.set(chave(s), (mapa.get(chave(s)) ?? 0) + 1);
  return mapa;
};

export function FilaSolicitacoes() {
  const { dados, erro, carregando, recarregar } = useConsulta(api.solicitacoes, 30_000);
  const [filtro, setFiltro] = useState<EstadoFiltro>(lerSalvo);
  const [painelAberto, setPainelAberto] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(lerPorPagina);
  const [aberta, setAberta] = useState<string | null>(null);
  const busca = useDeferredValue(filtro.busca);

  const lista = useMemo(() => dados ?? [], [dados]);

  function mudar(parcial: Partial<EstadoFiltro>) {
    setFiltro((atual) => {
      const novo = { ...atual, ...parcial };
      // Trocar o setor limpa o fluxo que não é dele.
      if (parcial.setor !== undefined && novo.fluxo && !lista.some((s) => chaveSetor(s) === novo.setor && String(s.origem?.fluxo?.id) === novo.fluxo)) novo.fluxo = '';
      guardar(CHAVE_STORAGE, JSON.stringify(novo));
      return novo;
    });
    setPagina(1);
  }

  function limpar() {
    setFiltro(PADRAO);
    guardar(CHAVE_STORAGE, JSON.stringify(PADRAO));
    setPagina(1);
  }

  // Opções dos campos: só o que existe nas solicitações carregadas (com a quantidade).
  const opcoes = useMemo(() => {
    const setores = new Map<string, string>();
    const fluxos = new Map<string, { nome: string; setor: string }>();
    const responsaveis = new Set<string>();
    const pedidoPor = new Set<string>();
    for (const s of lista) {
      setores.set(chaveSetor(s), s.origem?.setor?.descricao ?? 'Sem setor');
      if (s.origem?.fluxo) fluxos.set(String(s.origem.fluxo.id), { nome: s.origem.fluxo.descricao, setor: chaveSetor(s) });
      if (s.responsavel) responsaveis.add(s.responsavel);
      if (s.solicitadoPor) pedidoPor.add(s.solicitadoPor);
    }
    const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
    return {
      setores: [...setores.entries()].sort((a, b) => porNome(a[1], b[1])),
      fluxos: [...fluxos.entries()].filter(([, f]) => !filtro.setor || f.setor === filtro.setor).sort((a, b) => porNome(a[1].nome, b[1].nome)),
      responsaveis: [...responsaveis].sort(porNome),
      pedidoPor: [...pedidoPor].sort(porNome),
      contagemStatus: contar(lista, (s) => s.status),
      contagemTipo: contar(lista, (s) => s.tipo),
    };
  }, [lista, filtro.setor]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    return lista.filter(
      (s) =>
        (!filtro.setor || chaveSetor(s) === filtro.setor) &&
        (!filtro.fluxo || String(s.origem?.fluxo?.id) === filtro.fluxo) &&
        (!filtro.responsavel || s.responsavel === filtro.responsavel) &&
        (!filtro.pedidoPor || (filtro.pedidoPor === SEM ? !s.solicitadoPor : s.solicitadoPor === filtro.pedidoPor)) &&
        (!filtro.status.length || filtro.status.includes(s.status)) &&
        (!filtro.tipos.length || filtro.tipos.includes(s.tipo)) &&
        dentro(dia(s.criadaEm), filtro.criadaDe, filtro.criadaAte) &&
        dentro(dia(s.conclusao?.em), filtro.concluidaDe, filtro.concluidaAte) &&
        (!termo || normalizar(`${s.clienteNome} ${s.empresa} ${s.tarefaId} ${s.processoId} ${s.tarefaTitulo ?? ''}`).includes(termo)),
    );
  }, [lista, filtro, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaVisivel = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaVisivel - 1) * porPagina, paginaVisivel * porPagina);
  const comFiltro = JSON.stringify({ ...filtro, busca: '' }) !== JSON.stringify({ ...PADRAO, busca: '' }) || Boolean(filtro.busca);

  function mudarPorPagina(n: number) {
    const primeira = (paginaVisivel - 1) * porPagina;
    setPorPagina(n);
    setPagina(Math.floor(primeira / n) + 1);
    guardar(CHAVE_POR_PAGINA, String(n));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Solicitações</h1>
        <p className="mt-1 text-zinc-400">Confira, ajuste e conclua os pedidos preparados pela automação.</p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-zinc-900/60">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Filter className="h-4 w-4 text-violet-300" /> Filtros
          </h2>
          <div className="flex items-center gap-1">
            {comFiltro && (
              <button onClick={limpar} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200">
                <FilterX className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
            <button onClick={() => setPainelAberto((a) => !a)} aria-label={painelAberto ? 'Recolher filtros' : 'Abrir filtros'} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200">
              {painelAberto ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {painelAberto && (
          <div className="space-y-4 border-t border-white/5 px-4 pb-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Campo rotulo="Setor">
                <select value={filtro.setor} onChange={(e) => mudar({ setor: e.target.value })} className={estiloCampo}>
                  <option value="">Todos os setores</option>
                  {opcoes.setores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Fluxo">
                <select value={filtro.fluxo} onChange={(e) => mudar({ fluxo: e.target.value })} className={estiloCampo} disabled={!opcoes.fluxos.length}>
                  <option value="">{filtro.setor ? 'Todos os fluxos do setor' : 'Todos os fluxos'}</option>
                  {opcoes.fluxos.map(([id, f]) => <option key={id} value={id}>{f.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Usuário responsável">
                <select value={filtro.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })} className={estiloCampo}>
                  <option value="">Todos os usuários</option>
                  {opcoes.responsaveis.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Situação">
                <SeletorMultiplo
                  valor={filtro.status}
                  aoMudar={(status) => mudar({ status })}
                  opcoes={(Object.keys(ROTULO_STATUS) as StatusSolicitacao[]).map((v) => ({ valor: v, rotulo: ROTULO_STATUS[v], contagem: opcoes.contagemStatus.get(v) ?? 0 }))}
                />
              </Campo>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Campo rotulo="Destinatário">
                <SeletorMultiplo
                  valor={filtro.tipos}
                  aoMudar={(tipos) => mudar({ tipos })}
                  vazio="Todos"
                  opcoes={(Object.keys(VISUAL_TIPO) as TipoSolicitacao[]).map((v) => ({ valor: v, rotulo: VISUAL_TIPO[v].rotulo, contagem: opcoes.contagemTipo.get(v) ?? 0 }))}
                />
              </Campo>
              <Campo rotulo="Pedido por (quem mandou a IA executar)">
                <select value={filtro.pedidoPor} onChange={(e) => mudar({ pedidoPor: e.target.value })} className={estiloCampo}>
                  <option value="">Todos</option>
                  {opcoes.pedidoPor.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                  <option value={SEM}>Execução automática / sem nome</option>
                </select>
              </Campo>
              <div className="xl:col-span-2">
                <span className="mb-1 block text-xs text-zinc-400">Busca</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input value={filtro.busca} onChange={(e) => mudar({ busca: e.target.value })} placeholder="Cliente, empresa, nº da tarefa ou do processo" className={cn(estiloCampo, 'pl-9')} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <IntervaloDatas rotulo="Preparada em" de={filtro.criadaDe} ate={filtro.criadaAte} aoMudar={(de, ate) => mudar({ criadaDe: de, criadaAte: ate })} />
              <IntervaloDatas rotulo="Concluída em" de={filtro.concluidaDe} ate={filtro.concluidaAte} aoMudar={(de, ate) => mudar({ concluidaDe: de, concluidaAte: ate })} />
            </div>
          </div>
        )}
      </section>

      <LayoutGroup id="atalhos-solicitacoes">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/50 p-1">
          {ATALHOS.map((a) => {
            const ativo = mesmoConjunto(filtro.status, a.status);
            const quantidade = a.status.length ? a.status.reduce((n, st) => n + (opcoes.contagemStatus.get(st) ?? 0), 0) : lista.length;
            return (
              <button key={a.chave} onClick={() => mudar({ status: a.status })} className={cn('relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition', ativo ? 'text-white' : 'text-zinc-400 hover:text-zinc-200')}>
                {ativo && <motion.span layoutId="atalho-ativo" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{a.rotulo}</span>
                <span className="relative rounded-md bg-white/10 px-1.5 text-xs tabular-nums">{quantidade}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      <AvisoErro erro={erro} />

      <p className="text-sm text-zinc-400">
        {carregando ? 'Carregando…' : `${filtradas.length.toLocaleString('pt-BR')} de ${lista.length.toLocaleString('pt-BR')} solicitação(ões)`}
      </p>

      {carregando ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Esqueleto key={i} className="h-40" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((s, i) => <CartaoSolicitacao key={s.id} solicitacao={s} indice={i} aoAbrir={() => setAberta(s.id)} />)}
          {!visiveis.length && <div className="col-span-full grid h-40 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">Nenhuma solicitação neste filtro.</div>}
        </div>
      )}

      {!carregando && filtradas.length > 0 && (
        <Paginacao tamanhos={TAMANHOS_PAGINA} pagina={paginaVisivel} totalPaginas={totalPaginas} porPagina={porPagina} totalItens={filtradas.length} aoIr={(n) => setPagina(Math.min(Math.max(1, n), totalPaginas))} aoMudarPorPagina={mudarPorPagina} />
      )}

      <DetalheSolicitacao id={aberta} aoFechar={() => setAberta(null)} aoMudar={recarregar} />
    </div>
  );
}

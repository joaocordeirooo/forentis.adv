'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Check, FileText, Loader2, RefreshCw, Scissors, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, type DocumentoProcesso } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Solicitacao } from '@/models/solicitacao.model';
import { paginasParaTexto, textoParaPaginas } from '@/utils/paginas.util';

// Janela para o funcionário escolher as páginas de um PDF do processo (CTPS, procuração...) que vão no e-mail.

const TIPOS = [
  ['ctps', 'CTPS'],
  ['procuracao', 'Procuração'],
  ['ppp', 'PPP'],
  ['ficha_registro', 'Ficha de registro'],
  ['documento_pessoal', 'Documento pessoal'],
  ['cnis', 'CNIS'],
  ['outro', 'Outro documento'],
] as const;

export interface AjustePaginas {
  arquivoId: number;
  paginas: number[];
  tipo: string;
  substituirAnexoId: string;
}

export function SeletorPaginas({
  solicitacaoId,
  aberto,
  ajuste,
  funcionario,
  aoConcluir,
  aoFechar,
}: {
  solicitacaoId: string;
  aberto: boolean;
  ajuste: AjustePaginas | null; // preenchido = "ajustar páginas" de um anexo existente
  funcionario: string;
  aoConcluir: (s: Solicitacao, mensagem: string) => void;
  aoFechar: () => void;
}) {
  const [documentos, setDocumentos] = useState<DocumentoProcesso[] | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [arquivoId, setArquivoId] = useState<number | null>(null);
  const [pdf, setPdf] = useState<{ url: string; paginas: number } | null>(null);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [texto, setTexto] = useState('');
  const [atual, setAtual] = useState(1);
  const [tipo, setTipo] = useState('ctps');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Abre: carrega a lista dos PDFs do processo (e, no ajuste, já abre o arquivo do anexo).
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    api
      .documentosProcesso(solicitacaoId)
      .then((lista) => {
        if (!ativo) return;
        setDocumentos(lista);
        const primeiro = ajuste?.arquivoId ?? lista.find((d) => d.tipo === 'ctps')?.id ?? lista[0]?.id ?? null;
        escolher(primeiro, lista, ajuste);
      })
      .catch((e) => ativo && setErro((e as Error).message));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, solicitacaoId, ajuste]);

  // Libera o PDF da memória ao trocar de arquivo ou fechar.
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);

  async function escolher(id: number | null, lista = documentos, inicial: AjustePaginas | null = null) {
    setArquivoId(id);
    setPdf(null);
    setSelecionadas(inicial?.paginas ?? []);
    setTexto(inicial ? paginasParaTexto(inicial.paginas) : '');
    setAtual(inicial?.paginas[0] ?? 1);
    if (!id) return;
    const doc = lista?.find((d) => d.id === id);
    setTipo(inicial?.tipo && TIPOS.some(([v]) => v === inicial.tipo) ? inicial.tipo : doc?.tipo ?? 'outro');
    setCarregandoPdf(true);
    setErro(null);
    try {
      const { blob, paginas } = await api.baixarDocumento(solicitacaoId, id);
      setPdf({ url: URL.createObjectURL(blob), paginas });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregandoPdf(false);
    }
  }

  function aplicar(lista: number[]) {
    setSelecionadas(lista);
    setTexto(paginasParaTexto(lista));
  }

  function alternar(p: number) {
    setAtual(p);
    aplicar(selecionadas.includes(p) ? selecionadas.filter((x) => x !== p) : [...selecionadas, p].sort((a, b) => a - b));
  }

  function digitar(valor: string) {
    setTexto(valor);
    const lista = pdf ? textoParaPaginas(valor, pdf.paginas) : null;
    if (lista) setSelecionadas(lista);
  }

  function fechar() {
    setErro(null);
    setDocumentos(null);
    setArquivoId(null);
    setPdf(null);
    aoFechar();
  }

  async function confirmar() {
    if (!arquivoId || !selecionadas.length) return;
    if (funcionario.trim().length < 2) return setErro('Informe seu nome no rodapé do pedido antes.');
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await api.anexarPaginas(solicitacaoId, {
        por: funcionario.trim(),
        arquivoId,
        paginas: selecionadas,
        tipo,
        ...(ajuste ? { substituirAnexoId: ajuste.substituirAnexoId } : {}),
      });
      setDocumentos(null);
      setPdf(null);
      aoConcluir(atualizada, ajuste ? 'Páginas do anexo ajustadas.' : `${selecionadas.length} página(s) anexada(s).`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const grupos = useMemo(() => {
    const mapa = new Map<string, DocumentoProcesso[]>();
    for (const d of documentos ?? []) mapa.set(d.rotulo, [...(mapa.get(d.rotulo) ?? []), d]);
    return [...mapa.entries()];
  }, [documentos]);
  const documento = documentos?.find((d) => d.id === arquivoId) ?? null;
  const listaCarregando = carregandoLista || (aberto && documentos === null && !erro);
  const textoInvalido = Boolean(texto.trim()) && pdf !== null && textoParaPaginas(texto, pdf.paginas) === null;

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-6" onClick={aoFechar}>
          <motion.div
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
              <h2 className="flex items-center gap-2 font-semibold text-white">
                <Scissors className="h-4 w-4 text-indigo-300" /> {ajuste ? 'Ajustar páginas do anexo' : 'Escolher páginas para o e-mail'}
              </h2>
              <button onClick={fechar} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_1fr_260px]">
              {/* Documentos do processo */}
              <aside className="min-h-0 overflow-y-auto border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Documentos do processo</p>
                  <button
                    onClick={() => { setCarregandoLista(true); api.documentosProcesso(solicitacaoId, true).then(setDocumentos).catch((e) => setErro((e as Error).message)).finally(() => setCarregandoLista(false)); }}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-200"
                    title="Recarregar do Lawyertool"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', listaCarregando && 'animate-spin')} />
                  </button>
                </div>
                {listaCarregando && !documentos && <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-zinc-500" />}
                {documentos && !documentos.length && <p className="px-1 text-sm text-zinc-500">Nenhum PDF neste processo.</p>}
                {grupos.map(([rotulo, lista]) => (
                  <div key={rotulo} className="mb-3">
                    <p className="mb-1 px-1 text-xs text-zinc-400">{rotulo}</p>
                    {lista.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => !ajuste && escolher(d.id)}
                        disabled={Boolean(ajuste) && d.id !== arquivoId}
                        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition', d.id === arquivoId ? 'bg-indigo-500/15 text-white' : 'text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent')}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                        <span className="truncate">{d.nome}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </aside>

              {/* Visualização */}
              <section className="relative min-h-[40vh] bg-zinc-900/60">
                {carregandoPdf && <div className="absolute inset-0 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>}
                {pdf && <iframe key={`${pdf.url}-${atual}`} src={`${pdf.url}#page=${atual}`} title={documento?.nome ?? 'PDF'} className="h-full w-full" />}
                {!pdf && !carregandoPdf && <div className="grid h-full place-items-center text-sm text-zinc-500">Escolha um documento à esquerda.</div>}
              </section>

              {/* Páginas */}
              <aside className="flex min-h-0 flex-col border-t border-white/10 lg:border-l lg:border-t-0">
                <div className="space-y-3 p-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-zinc-400">Tipo do documento</span>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500">
                      {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-zinc-400">Páginas (ex.: 1-2, 5, 8-9)</span>
                    <input
                      value={texto}
                      onChange={(e) => digitar(e.target.value)}
                      disabled={!pdf}
                      placeholder={pdf ? `de 1 a ${pdf.paginas}` : ''}
                      className={cn('w-full rounded-xl border bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none disabled:opacity-50', textoInvalido ? 'border-rose-500' : 'border-white/10 focus:border-indigo-500')}
                    />
                  </label>
                  {pdf && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{selecionadas.length} de {pdf.paginas} marcada(s)</span>
                      <span className="flex gap-2">
                        <button onClick={() => aplicar(Array.from({ length: pdf.paginas }, (_, i) => i + 1))} className="text-indigo-300 hover:text-indigo-200">Todas</button>
                        <button onClick={() => aplicar([])} className="text-zinc-400 hover:text-zinc-200">Limpar</button>
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  {pdf && (
                    <div className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: pdf.paginas }, (_, i) => i + 1).map((p) => {
                        const marcada = selecionadas.includes(p);
                        return (
                          <button
                            key={p}
                            onClick={() => alternar(p)}
                            title={`Página ${p}: clique para ${marcada ? 'desmarcar' : 'marcar'} e ver`}
                            className={cn(
                              'relative grid h-10 place-items-center rounded-lg border text-sm tabular-nums transition',
                              marcada ? 'border-indigo-400 bg-indigo-500/25 text-white' : 'border-white/10 text-zinc-400 hover:border-white/30 hover:text-zinc-200',
                              p === atual && 'ring-2 ring-white/40',
                            )}
                          >
                            {p}
                            {marcada && <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-indigo-200" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {pdf && <p className="mt-3 text-xs text-zinc-500">Clique no número para marcar e ver a página ao lado.</p>}
                </div>
              </aside>
            </div>

            <footer className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-3">
              {erro ? <p className="text-sm text-rose-300">{erro}</p> : <p className="text-sm text-zinc-400">{documento ? `${documento.nome}${selecionadas.length ? ` · págs. ${paginasParaTexto(selecionadas)}` : ''}` : ''}</p>}
              <div className="ml-auto flex gap-2">
                <button onClick={fechar} className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Cancelar</button>
                <button
                  onClick={confirmar}
                  disabled={!selecionadas.length || salvando || textoInvalido}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                  {ajuste ? 'Salvar páginas' : `Anexar ${selecionadas.length || ''} página(s)`}
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

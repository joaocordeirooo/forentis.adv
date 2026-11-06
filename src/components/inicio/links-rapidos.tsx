'use client';

import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Atalho {
  nome: string;
  url: string;
}

// Lista padrão; cada pessoa pode editar a sua (fica guardada no navegador).
const PADRAO: Atalho[] = [
  { nome: 'Lawyertool', url: 'https://lawyertool.damadvogados.com.br:6080' },
  { nome: 'eproc TRF4', url: 'https://eproc1g.trf4.jus.br/eproc/' },
  { nome: 'eproc TJSC', url: 'https://eproc1g.tjsc.jus.br/eproc/' },
  { nome: 'eproc TJRS', url: 'https://eproc1g.tjrs.jus.br/eproc/' },
  { nome: 'Projudi TJPR', url: 'https://projudi.tjpr.jus.br/projudi/' },
  { nome: 'Meu INSS', url: 'https://meu.inss.gov.br/' },
  { nome: 'ChatGuru', url: 'https://s20.chatguru.app/' },
];
const CHAVE = 'forentis.links';

function dominio(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LinksRapidos() {
  const [links, setLinks] = useState<Atalho[]>(PADRAO);
  const [editando, setEditando] = useState(false);
  const [novo, setNovo] = useState({ nome: '', url: '' });

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo) setLinks(JSON.parse(salvo));
    } catch {
      /* sem armazenamento: usa o padrão */
    }
  }, []);

  const salvar = (lista: Atalho[]) => {
    setLinks(lista);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
    } catch {
      /* ignora */
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-zinc-100">Links rápidos</h2>
        <button onClick={() => setEditando(!editando)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200">
          <Pencil className="h-3.5 w-3.5" /> {editando ? 'Pronto' : 'Editar'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map((l, i) => (
          <div key={`${l.url}-${i}`} className="group relative">
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2.5 text-sm text-zinc-200 transition-colors hover:border-white/15 hover:bg-white/5"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-zinc-300">{l.nome.slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block truncate">{l.nome}</span>
                <span className="block truncate text-[11px] text-zinc-500">{dominio(l.url)}</span>
              </span>
              <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-600" />
            </a>
            {editando && (
              <button onClick={() => salvar(links.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-600 p-1 text-white" aria-label={`Remover ${l.nome}`}>
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {editando && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!novo.nome.trim() || !/^https?:\/\//.test(novo.url.trim())) return;
            salvar([...links, { nome: novo.nome.trim(), url: novo.url.trim() }]);
            setNovo({ nome: '', url: '' });
          }}
        >
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-violet-500 sm:w-40" />
          <input value={novo.url} onChange={(e) => setNovo({ ...novo, url: e.target.value })} placeholder="https://..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/15">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </form>
      )}
    </section>
  );
}

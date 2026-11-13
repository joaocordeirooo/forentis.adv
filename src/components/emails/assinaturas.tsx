'use client';

import { CheckCircle2, ImageUp, Loader2, Pencil, Plug, Plus, Trash2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { Esqueleto } from '@/components/ui/esqueleto';
import { PainelLateral } from '@/components/ui/painel-lateral';
import { useConsulta } from '@/hooks/use-consulta';
import { apiEmails, type DadosAssinatura, type TesteConexao } from '@/lib/api-emails';
import { cn } from '@/lib/utils';
import type { AssinaturaEmail } from '@/models/assinatura-email.model';
import { Campo, estiloCampo, Vazio } from './comum';

// Assinaturas de quem envia pela caixa única + teste da conexão com o servidor de e-mail.

function Previa({ id, versao }: { id: string; versao: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    apiEmails
      .previaAssinatura(id)
      .then((h) => ativo && setHtml(h))
      .catch((e) => ativo && setErro((e as Error).message));
    return () => {
      ativo = false;
    };
  }, [id, versao]);
  if (erro) return <p className="text-xs text-rose-300">{erro}</p>;
  if (html === null) return <Esqueleto className="h-40" />;
  // Fundo branco: é assim que a empresa vê no e-mail.
  return <iframe title="Prévia da assinatura" srcDoc={html} sandbox="" className="h-64 w-full rounded-xl bg-white" />;
}

const VAZIO: DadosAssinatura = { nome: '', cargo: null, oab: null, telefone: null, whatsapp: null, email: null, ativa: true };

function FormAssinatura({ assinatura, aoSalvar }: { assinatura: AssinaturaEmail | null; aoSalvar: (a: AssinaturaEmail) => void }) {
  const [form, setForm] = useState<DadosAssinatura>(() =>
    assinatura
      ? { nome: assinatura.nome, cargo: assinatura.cargo, oab: assinatura.oab, telefone: assinatura.telefone, whatsapp: assinatura.whatsapp, email: assinatura.email, ativa: assinatura.ativa }
      : VAZIO,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const mudar = (campo: keyof DadosAssinatura, valor: string) => setForm((f) => ({ ...f, [campo]: valor || null }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const dados = { ...form, nome: (form.nome ?? '').trim() };
      aoSalvar(assinatura ? await apiEmails.editarAssinatura(assinatura.id, dados) : await apiEmails.criarAssinatura(dados));
    } catch (e) {
      setErro(e as Error);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo rotulo="Nome" dica="Igual ao nome que a pessoa informa ao enviar (é assim que a assinatura é escolhida).">
        <input value={form.nome ?? ''} onChange={(e) => mudar('nome', e.target.value)} required minLength={2} className={estiloCampo} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Cargo / setor">
          <input value={form.cargo ?? ''} onChange={(e) => mudar('cargo', e.target.value)} placeholder="Arquivo Administrativo" className={estiloCampo} />
        </Campo>
        <Campo rotulo="OAB (se advogado)">
          <input value={form.oab ?? ''} onChange={(e) => mudar('oab', e.target.value)} placeholder="OAB/SC 00.000" className={estiloCampo} />
        </Campo>
        <Campo rotulo="Telefone">
          <input value={form.telefone ?? ''} onChange={(e) => mudar('telefone', e.target.value)} placeholder="(49) 99999-9999 / 3246-3138" className={estiloCampo} />
        </Campo>
        <Campo rotulo="WhatsApp">
          <input value={form.whatsapp ?? ''} onChange={(e) => mudar('whatsapp', e.target.value)} className={estiloCampo} />
        </Campo>
      </div>
      <Campo rotulo="E-mail de contato (opcional)" dica="Vazio = o e-mail da caixa de solicitações.">
        <input type="email" value={form.email ?? ''} onChange={(e) => mudar('email', e.target.value)} className={estiloCampo} />
      </Campo>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={form.ativa} onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.checked }))} className="accent-violet-500" /> Ativa
      </label>
      <p className="text-xs text-zinc-500">A imagem pronta da assinatura é enviada depois de salvar, no cartão da pessoa.</p>
      <AvisoErro erro={erro} />
      <div className="flex justify-end">
        <button disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </button>
      </div>
    </form>
  );
}

function CartaoAssinatura({ assinatura, aoEditar, aoMudar }: { assinatura: AssinaturaEmail; aoEditar: () => void; aoMudar: () => void }) {
  const seletor = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<'imagem' | 'remover' | 'excluir' | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);

  async function executar(tipo: 'imagem' | 'remover' | 'excluir', acao: () => Promise<unknown>) {
    setOcupado(tipo);
    setErro(null);
    try {
      await acao();
      aoMudar();
    } catch (e) {
      setErro(e as Error);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <article className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-100">{assinatura.nome}</p>
          <p className="truncate text-xs text-zinc-500">
            {[assinatura.cargo, assinatura.imagem ? 'imagem pronta' : 'assinatura em texto', assinatura.ativa ? null : 'inativa'].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={aoEditar} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <Previa id={assinatura.id} versao={assinatura.atualizadaEm} />

      <AvisoErro erro={erro} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => seletor.current?.click()}
          disabled={ocupado !== null}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-violet-200 ring-1 ring-white/10 hover:bg-violet-500/10 disabled:opacity-50"
        >
          {ocupado === 'imagem' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />} {assinatura.imagem ? 'Trocar imagem' : 'Enviar imagem'}
        </button>
        <input
          ref={seletor}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = '';
            if (arquivo) executar('imagem', () => apiEmails.enviarImagemAssinatura(assinatura.id, arquivo));
          }}
        />
        {assinatura.imagem && (
          <button
            onClick={() => executar('remover', () => apiEmails.editarAssinatura(assinatura.id, { imagem: null }))}
            disabled={ocupado !== null}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200 disabled:opacity-50"
          >
            Usar assinatura em texto
          </button>
        )}
        <div className="ml-auto">
          {confirmar ? (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
              Excluir?
              <button onClick={() => setConfirmar(false)} className="rounded-lg px-2 py-1 hover:text-zinc-200">
                Não
              </button>
              <button
                onClick={() => executar('excluir', () => apiEmails.excluirAssinatura(assinatura.id))}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 font-medium text-white hover:bg-rose-500"
              >
                {ocupado === 'excluir' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Sim
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmar(true)} className="rounded-lg p-2 text-zinc-500 hover:text-rose-300" aria-label="Excluir assinatura">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">Imagem: PNG ou JPG, 1200 × 300 px, até 600 KB.</p>
    </article>
  );
}

function TesteServidor() {
  const [resultado, setResultado] = useState<TesteConexao | null>(null);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const Item = ({ ok, texto, detalhe }: { ok: boolean; texto: string; detalhe?: string | null }) => (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
      <span className={ok ? 'text-zinc-200' : 'text-rose-200'}>
        {texto}
        {detalhe && <span className="block text-xs text-zinc-500">{detalhe}</span>}
      </span>
    </li>
  );
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-100">Servidor de e-mail</p>
          <p className="text-xs text-zinc-500">Confere login no envio (SMTP), na leitura (IMAP) e a pasta Enviados. Não envia nada.</p>
        </div>
        <button
          onClick={async () => {
            setTestando(true);
            setErro(null);
            try {
              setResultado(await apiEmails.testarConexao());
            } catch (e) {
              setErro(e as Error);
            } finally {
              setTestando(false);
            }
          }}
          disabled={testando}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-violet-200 ring-1 ring-white/10 hover:bg-violet-500/10 disabled:opacity-50"
        >
          {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Testar conexão
        </button>
      </div>
      <AvisoErro erro={erro} />
      {resultado && (
        <ul className="space-y-1.5">
          <Item ok={resultado.smtp.ok} texto={`Envio (${resultado.smtp.servidor}) — ${resultado.conta}`} detalhe={resultado.smtp.erro} />
          <Item ok={resultado.imap.ok} texto={`Leitura (${resultado.imap.servidor})`} detalhe={resultado.imap.erro} />
          {resultado.imap.ok && (
            <Item
              ok={resultado.pastaEnviados.existe}
              texto={`Pasta Enviados: ${resultado.pastaEnviados.nome}`}
              detalhe={resultado.pastaEnviados.existe ? null : `Não existe. Pastas da conta: ${resultado.pastas.join(', ')}`}
            />
          )}
        </ul>
      )}
    </div>
  );
}

type Painel = { modo: 'nova' } | { modo: 'editar'; assinatura: AssinaturaEmail } | null;

export function Assinaturas() {
  const { dados, erro, carregando, recarregar } = useConsulta(apiEmails.assinaturas);
  const [painel, setPainel] = useState<Painel>(null);

  return (
    <div className="space-y-4">
      <TesteServidor />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">Quem não tiver assinatura cadastrada sai com o nome e os dados do escritório.</p>
        <button onClick={() => setPainel({ modo: 'nova' })} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500">
          <Plus className="h-4 w-4" /> Nova assinatura
        </button>
      </div>
      <AvisoErro erro={erro} />
      {carregando && !dados ? (
        <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Esqueleto key={i} className="h-72" />)}</div>
      ) : dados?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {dados.map((a) => (
            <CartaoAssinatura key={a.id} assinatura={a} aoEditar={() => setPainel({ modo: 'editar', assinatura: a })} aoMudar={recarregar} />
          ))}
        </div>
      ) : (
        <Vazio icone={Pencil} texto="Nenhuma assinatura cadastrada." />
      )}

      <PainelLateral
        aberto={painel !== null}
        aoFechar={() => setPainel(null)}
        titulo={<h2 className={cn('text-lg font-semibold text-white')}>{painel?.modo === 'editar' ? `Editar · ${painel.assinatura.nome}` : 'Nova assinatura'}</h2>}
      >
        {painel && (
          <FormAssinatura
            key={painel.modo === 'editar' ? painel.assinatura.id : 'nova'}
            assinatura={painel.modo === 'editar' ? painel.assinatura : null}
            aoSalvar={() => {
              setPainel(null);
              recarregar();
            }}
          />
        )}
      </PainelLateral>
    </div>
  );
}

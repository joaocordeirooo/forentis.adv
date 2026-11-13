'use client';

import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { AvisoErro } from '@/components/ui/aviso-erro';
import { apiEmails, arquivoParaBase64 } from '@/lib/api-emails';
import { cn } from '@/lib/utils';
import type { ConversaEmail } from '@/models/email.model';
import { Campo, estiloCampo, guardarFuncionario, lerFuncionario, tamanho } from './comum';

// E-mail avulso pela caixa única (as solicitações às empresas continuam saindo pela tela de Solicitações).

const separar = (texto: string) => texto.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
const MAX_ANEXOS_MB = 15;

export function NovoEmail({ aoEnviar }: { aoEnviar: (c: ConversaEmail) => void }) {
  const [para, setPara] = useState('');
  const [cc, setCc] = useState('');
  const [assunto, setAssunto] = useState('');
  const [texto, setTexto] = useState('Prezados,\n\n\n\nAtenciosamente,');
  const [tarefa, setTarefa] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [funcionario, setFuncionario] = useState(lerFuncionario);
  const [anexos, setAnexos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<Error | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const seletor = useRef<HTMLInputElement>(null);

  const totalMb = anexos.reduce((s, a) => s + a.size, 0) / 1024 / 1024;
  const tarefaId = Number(tarefa.replace(/\D/g, '')) || null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    setAviso(null);
    guardarFuncionario(funcionario);
    try {
      const resultado = await apiEmails.enviar({
        para: separar(para),
        cc: separar(cc),
        assunto,
        texto,
        funcionario,
        vinculo: { tipo: 'avulso', tarefaId, empresa: empresa.trim() || null },
        anexos: await Promise.all(anexos.map(arquivoParaBase64)),
      });
      if (!resultado.enviado) setAviso(`Não saiu: ${resultado.motivo ?? 'erro no envio'}. A conversa ficou registrada para tentar de novo.`);
      aoEnviar(resultado.conversa);
    } catch (e) {
      setErro(e as Error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo rotulo="Para" dica="Separe vários endereços com vírgula.">
        <input value={para} onChange={(e) => setPara(e.target.value)} required placeholder="rh@empresa.com.br" className={estiloCampo} />
      </Campo>
      <Campo rotulo="Cópia (opcional)">
        <input value={cc} onChange={(e) => setCc(e.target.value)} className={estiloCampo} />
      </Campo>
      <Campo rotulo="Assunto" dica="O código do pedido ([DAM-…]) entra sozinho no fim do assunto.">
        <input value={assunto} onChange={(e) => setAssunto(e.target.value)} required maxLength={200} className={estiloCampo} />
      </Campo>
      <Campo rotulo="Texto" dica="A assinatura entra sozinha.">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} required rows={9} className={cn(estiloCampo, 'resize-y leading-relaxed')} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tarefa do Lawyertool (opcional)" dica="Com a tarefa, envio e resposta são comentados nela.">
          <input value={tarefa} onChange={(e) => setTarefa(e.target.value)} inputMode="numeric" placeholder="6766" className={estiloCampo} />
        </Campo>
        <Campo rotulo="Empresa (opcional)">
          <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={estiloCampo} />
        </Campo>
      </div>

      <div>
        <span className="mb-1 block text-xs text-zinc-400">Anexos</span>
        <div className="flex flex-wrap gap-1.5">
          {anexos.map((a, i) => (
            <span key={`${a.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-inset ring-white/10">
              <Paperclip className="h-3.5 w-3.5" /> <span className="max-w-48 truncate">{a.name}</span> <span className="text-zinc-500">{tamanho(a.size)}</span>
              <button type="button" onClick={() => setAnexos(anexos.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-rose-300" aria-label="Remover anexo">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => seletor.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-violet-200 ring-1 ring-inset ring-white/10 hover:bg-violet-500/10">
            <Paperclip className="h-3.5 w-3.5" /> Adicionar
          </button>
          <input
            ref={seletor}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              setAnexos([...anexos, ...Array.from(e.target.files ?? [])].slice(0, 10));
              e.target.value = '';
            }}
          />
        </div>
        {totalMb > MAX_ANEXOS_MB && <p className="mt-1 text-xs text-rose-300">Anexos somam {totalMb.toFixed(1)} MB (máximo {MAX_ANEXOS_MB} MB).</p>}
      </div>

      <Campo rotulo="Seu nome (escolhe a assinatura)">
        <input value={funcionario} onChange={(e) => setFuncionario(e.target.value)} required minLength={2} className={estiloCampo} />
      </Campo>

      <AvisoErro erro={erro} />
      {aviso && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{aviso}</p>}

      <div className="flex justify-end">
        <button disabled={enviando || totalMb > MAX_ANEXOS_MB} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
        </button>
      </div>
    </form>
  );
}

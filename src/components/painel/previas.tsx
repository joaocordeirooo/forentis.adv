'use client';

import { motion } from 'motion/react';
import { CheckCheck, Mail, Paperclip } from 'lucide-react';
import { telefone } from '@/lib/formato';

// Prévia de como a mensagem chega no WhatsApp do cliente.
export function PreviaWhatsApp({ nome, numero, texto, modoTeste }: { nome: string; numero: string | null; texto: string; modoTeste: boolean }) {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b141a] shadow-2xl">
      <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">{nome.slice(0, 1)}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{modoTeste ? `TESTE - ${nome}` : nome}</p>
          <p className="text-xs text-zinc-400">{modoTeste ? 'número de teste' : telefone(numero)}</p>
        </div>
      </div>
      <div className="min-h-40 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:14px_14px] p-4">
        <motion.div
          key={texto}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-sm text-zinc-100 shadow"
        >
          <p className="text-[11px] italic text-emerald-200/70">Diálogo &quot;chamar o cliente com motivo&quot; · {'{Documentos_Pendentes}'}:</p>
          <p className="mt-1 whitespace-pre-wrap">{texto || '…'}</p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-emerald-200/60">
            agora <CheckCheck className="h-3 w-3 text-sky-300" />
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Cabeçalho do e-mail para a empresa.
export function PreviaEmail({ para, assunto, anexos }: { para: string | null; assunto: string | null; anexos: number }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
      <p className="flex items-center gap-2 text-zinc-400">
        <Mail className="h-4 w-4 text-indigo-300" /> Para: <span className="text-zinc-100">{para ?? 'não informado'}</span>
      </p>
      <p className="text-zinc-400">
        Assunto: <span className="text-zinc-100">{assunto}</span>
      </p>
      <p className="flex items-center gap-2 text-zinc-400">
        <Paperclip className="h-4 w-4" /> {anexos} anexo(s) selecionado(s)
      </p>
    </div>
  );
}

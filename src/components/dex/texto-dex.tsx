import { Fragment, type ReactNode } from 'react';

// Formata o texto da DEX: **negrito**, listas com "-" ou "1." e quebras de linha. Sem HTML externo.
function negrito(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? <strong key={i} className="font-semibold text-white">{parte.slice(2, -2)}</strong> : <Fragment key={i}>{parte}</Fragment>,
  );
}

export function TextoDex({ texto }: { texto: string }) {
  const blocos: ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  const fecharLista = () => {
    if (!lista) return;
    const Tag = lista.ordenada ? 'ol' : 'ul';
    blocos.push(
      <Tag key={blocos.length} className={lista.ordenada ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}>
        {lista.itens.map((item, i) => <li key={i}>{negrito(item)}</li>)}
      </Tag>,
    );
    lista = null;
  };

  for (const linha of texto.split('\n')) {
    const item = linha.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    if (item) {
      const ordenada = Boolean(item[1]);
      if (lista && lista.ordenada !== ordenada) fecharLista();
      if (!lista) lista = { ordenada, itens: [] };
      lista.itens.push(item[2]);
    } else {
      fecharLista();
      if (linha.trim()) blocos.push(<p key={blocos.length}>{negrito(linha.replace(/^#+\s*/, ''))}</p>);
    }
  }
  fecharLista();
  return <div className="space-y-2">{blocos}</div>;
}

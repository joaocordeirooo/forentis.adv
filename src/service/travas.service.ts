import type { Pendencia } from '@/models/analise.model';
import type { Comentario } from '@/models/lawyertool.model';
import { hash } from '@/utils/hash.util';
import { normalizar, normalizarChave } from '@/utils/texto.util';

// Regras que evitam pedir a mesma coisa duas vezes (as mesmas do n8n).
// Funcionam pelos comentários da tarefa, então também enxergam o que o n8n e a Central já fizeram.

export const MARCADOR = '[AUTOMACAO_SOLICITACAO_DOCUMENTOS]';
const TITULO_CLIENTE = 'PROVIDÊNCIA DO FUNCIONÁRIO — CONTATO COM O CLIENTE';
const MARCADORES = [MARCADOR, TITULO_CLIENTE, 'SOLICITAÇÃO AO CLIENTE — ENVIO MANUAL PELO WHATSAPP'];

export { TITULO_CLIENTE };

export function ehComentarioAutomatico(conteudo: unknown): boolean {
  const texto = String(conteudo ?? '').trim();
  return MARCADORES.some((m) => texto.startsWith(m));
}

function recente(comentario: Comentario, dias: number): boolean {
  const data = Date.parse(comentario.dataCad ?? comentario.dataAlt ?? '');
  return !Number.isNaN(data) && Date.now() - data < dias * 86_400_000;
}

export function assinaturaCliente(pendencias: Pendencia[], modoTeste: boolean): string {
  return hash(
    JSON.stringify([
      modoTeste ? 'teste' : 'producao',
      pendencias.map((p) => [normalizarChave(p.documento), normalizarChave(p.periodo), p.situacao]).sort(),
    ]),
  );
}

export function chaveEmpresa(nome: string): string {
  return normalizarChave(nome).replace(/ /g, '_') || 'sem_nome';
}

export function assinaturaEmpresa(chave: string, pendencias: Pendencia[]): string {
  return hash(
    JSON.stringify([chave, pendencias.map((p) => [normalizar(p.documento), normalizar(p.periodo), p.situacao]).sort()]),
  );
}

export function travasCliente(
  comentarios: Comentario[],
  assinatura: string,
  modoTeste: boolean,
  diasSemRepetir: number,
  maxEnvios: number,
) {
  // Comentários de teste não bloqueiam o envio real, e vice-versa.
  const doClienteMesmoModo = (c: Comentario) => {
    const t = String(c.conteudo ?? '');
    const ehCliente = (t.startsWith(MARCADOR) && t.includes('CONTATO COM O CLIENTE')) || t.startsWith(TITULO_CLIENTE);
    return ehCliente && t.includes('MODO TESTE') === modoTeste;
  };

  const mesmaAssinatura = comentarios.some((c) => String(c.conteudo ?? '').includes(`assinatura:${assinatura}`));
  const contatoRecente = diasSemRepetir > 0 && comentarios.some((c) => doClienteMesmoModo(c) && recente(c, diasSemRepetir));
  const enviosAnteriores = comentarios.filter(
    (c) => doClienteMesmoModo(c) && String(c.conteudo ?? '').includes('Situação: ENVIADO'),
  ).length;

  return { mesmaAssinatura, contatoRecente, enviosAnteriores, atingiuLimite: enviosAnteriores >= maxEnvios };
}

export function travasEmpresa(comentarios: Comentario[], assinatura: string, chave: string, diasSemRepetir: number) {
  const daMesmaEmpresa = (c: Comentario) => {
    const t = String(c.conteudo ?? '');
    return t.startsWith(MARCADOR) && t.includes(`empresa:${chave}`);
  };
  return {
    mesmaAssinatura: comentarios.some((c) => String(c.conteudo ?? '').includes(`assinatura:${assinatura}`)),
    tratadaRecentemente: diasSemRepetir > 0 && comentarios.some((c) => daMesmaEmpresa(c) && recente(c, diasSemRepetir)),
  };
}

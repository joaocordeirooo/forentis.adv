// Aceita datas completas ou mensais, sem inventar dias (regra do validarCNPJ do n8n).
function interpretarData(valor: unknown): string[] | null {
  const texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
  let ano: string, mes: string, dia: string | null = null;
  let m: RegExpMatchArray | null;

  if ((m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [, ano, mes, dia] = m;
  else if ((m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) [, dia, mes, ano] = m;
  else if ((m = texto.match(/^(\d{4})-(\d{2})$/))) [, ano, mes] = m;
  else if ((m = texto.match(/^(\d{2})\/(\d{4})$/))) [, mes, ano] = m;
  else return null;

  const a = Number(ano);
  const ms = Number(mes);
  if (a < 1000 || ms < 1 || ms > 12) return null;
  if (dia !== null) {
    const d = Number(dia);
    const limite = new Date(Date.UTC(a, ms, 0)).getUTCDate();
    if (d < 1 || d > limite) return null;
    return [`${ano}-${mes}-${dia}`, `${dia}/${mes}/${ano}`];
  }
  return [`${ano}-${mes}`, `${mes}/${ano}`];
}

export function dataPresenteNoTrecho(valor: unknown, trecho: string): boolean {
  const alternativas = interpretarData(valor);
  if (!alternativas) return false;
  const texto = trecho.replace(/\s+/g, ' ').trim();
  return alternativas.some((alt) => {
    const escapada = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\d/\\-])${escapada}(?=$|[^\\d/\\-])`).test(texto);
  });
}

// Data e hora no fuso de São Paulo, para textos (ex.: "05/11 06:30").
export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

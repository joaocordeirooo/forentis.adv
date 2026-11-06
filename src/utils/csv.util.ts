// Lê CSV no padrão RFC 4180: aspas, separador dentro de aspas e quebras de linha dentro de campos.
export function lerCsv(texto: string): Record<string, string>[] {
  const conteudo = texto.replace(/^﻿/, '');
  const primeiraLinha = conteudo.slice(0, conteudo.indexOf('\n') >= 0 ? conteudo.indexOf('\n') : undefined);
  const separador = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ';' : ',';

  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let entreAspas = false;

  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (entreAspas) {
      if (c === '"' && conteudo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreAspas = false;
      else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === separador) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && conteudo[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((v) => v.trim())) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v.trim())) linhas.push(linha);

  const [cabecalho, ...dados] = linhas;
  if (!cabecalho) return [];
  const nomes = cabecalho.map((n) => n.trim());
  return dados.map((valores) => Object.fromEntries(nomes.map((nome, i) => [nome, (valores[i] ?? '').trim()])));
}

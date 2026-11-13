import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { config } from '@/config/env.config';
import {
  ASSINATURA_PADRAO_ID,
  ESCRITORIO_ASSINATURA as ESC,
  LARGURA_IMAGEM_ASSINATURA,
  PASTA_IMAGENS_ASSINATURA,
} from '@/config/email.config';
import { AppError } from '@/errors/app.errors';
import type { AssinaturaEmail } from '@/models/assinatura-email.model';
import * as repositorio from '@/repositories/assinatura-email.repository';
import type { criarAssinaturaSchema, editarAssinaturaSchema } from '@/validators/assinatura-email.validator';

type DadosCriar = z.infer<typeof criarAssinaturaSchema>;
type DadosEditar = z.infer<typeof editarAssinaturaSchema>;

const CID_LOGO = 'logo-dam';
const CID_IMAGEM = 'assinatura';

const TIPOS_IMAGEM: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };
const tipoImagem = (arquivo: string) => TIPOS_IMAGEM[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream';

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

export function listar() {
  return repositorio.listarAssinaturas();
}

export async function obter(id: string): Promise<AssinaturaEmail> {
  if (id === ASSINATURA_PADRAO_ID) return assinaturaPadrao('Equipe DAM Advogados');
  const assinatura = await repositorio.obterAssinatura(id);
  if (!assinatura) throw new AppError('Assinatura não encontrada.', 404);
  return assinatura;
}

export async function criar(dados: DadosCriar): Promise<AssinaturaEmail> {
  const existentes = await repositorio.listarAssinaturas();
  if (existentes.some((a) => normalizar(a.nome) === normalizar(dados.nome))) {
    throw new AppError(`Já existe assinatura para "${dados.nome}".`, 409);
  }
  await conferirImagem(dados.imagem);
  const agora = new Date().toISOString();
  return repositorio.salvarAssinatura({ id: randomUUID(), ...dados, criadaEm: agora, atualizadaEm: agora });
}

export async function editar(id: string, dados: DadosEditar): Promise<AssinaturaEmail> {
  const atual = await obter(id);
  if (id === ASSINATURA_PADRAO_ID) throw new AppError('A assinatura padrão vem de email.config.ts.', 400);
  if (dados.imagem !== undefined) await conferirImagem(dados.imagem);
  return repositorio.salvarAssinatura({ ...atual, ...dados, atualizadaEm: new Date().toISOString() });
}

const MAX_IMAGEM_KB = 600;

// Recebe a imagem pronta da assinatura (PNG/JPG), grava em public/email/assinaturas e liga ao cadastro.
export async function salvarImagem(id: string, arquivo: File): Promise<AssinaturaEmail> {
  const atual = await obter(id);
  if (id === ASSINATURA_PADRAO_ID) throw new AppError('A assinatura padrão não tem imagem.', 400);
  const extensao = ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif' } as Record<string, string>)[arquivo.type];
  if (!extensao) throw new AppError('Envie a imagem em PNG, JPG ou GIF.', 415);
  if (arquivo.size > MAX_IMAGEM_KB * 1024) {
    throw new AppError(`Imagem com ${Math.round(arquivo.size / 1024)} KB: o máximo é ${MAX_IMAGEM_KB} KB. Reduza para 1200 x 300 px.`, 413);
  }
  const base = normalizar(atual.nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'assinatura';
  const nome = `${base}-${Date.now().toString(36)}${extensao}`;
  const destino = path.join(/*turbopackIgnore: true*/ process.cwd(), caminhoImagem(nome));
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, Buffer.from(await arquivo.arrayBuffer()));
  return repositorio.salvarAssinatura({ ...atual, imagem: nome, atualizadaEm: new Date().toISOString() });
}

export async function excluir(id: string): Promise<void> {
  if (!(await repositorio.removerAssinatura(id))) throw new AppError('Assinatura não encontrada.', 404);
}

function assinaturaPadrao(nome: string): AssinaturaEmail {
  const agora = new Date().toISOString();
  return {
    id: ASSINATURA_PADRAO_ID,
    nome,
    cargo: null,
    oab: null,
    telefone: null,
    whatsapp: null,
    email: null,
    imagem: null,
    ativa: true,
    criadaEm: agora,
    atualizadaEm: agora,
  };
}

// Acha a assinatura do funcionário pelo nome (sem diferença de acento/maiúscula).
// Sem cadastro, a assinatura sai só com o nome dele e os dados do escritório.
export async function resolverAssinatura(funcionario: string): Promise<AssinaturaEmail> {
  const nome = funcionario.trim();
  const achada = (await repositorio.listarAssinaturas()).find((a) => a.ativa && normalizar(a.nome) === normalizar(nome));
  return achada ?? assinaturaPadrao(nome || 'Equipe DAM Advogados');
}

async function lerArquivo(relativo: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), relativo));
  } catch {
    return null;
  }
}

const caminhoImagem = (arquivo: string) => path.posix.join(PASTA_IMAGENS_ASSINATURA, arquivo);

// O arquivo informado no cadastro precisa existir na pasta de imagens.
async function conferirImagem(arquivo: string | null | undefined): Promise<void> {
  if (arquivo && !(await lerArquivo(caminhoImagem(arquivo)))) {
    throw new AppError(`Imagem não encontrada: ${caminhoImagem(arquivo)}`, 422);
  }
}

export interface AssinaturaMontada {
  html: string;
  texto: string;
  // Imagem que vai junto do e-mail (inline, por "cid"): a assinatura pronta ou o logo.
  imagem: { nome: string; conteudo: Buffer; mimeType: string; cid: string } | null;
}

const dataUrl = (conteudo: Buffer, mimeType: string) => `data:${mimeType};base64,${conteudo.toString('base64')}`;

// Monta a assinatura em HTML (tabela com estilos inline: é o que funciona no Outlook/Gmail) e em texto puro.
// srcLogo: na prévia do navegador o logo vai como data: URL; no e-mail, como anexo "cid".
export async function montarAssinatura(a: AssinaturaEmail, srcLogo?: 'data-url'): Promise<AssinaturaMontada> {
  const emailContato = a.email ?? config.smtp.usuario;
  const juntar = (partes: (string | null | undefined)[], separador: string) => partes.filter(Boolean).join(separador);

  const linhas = {
    cargo: juntar([a.cargo, a.oab], ' · '),
    endereco: juntar([ESC.endereco, ESC.cidade], ' — '),
    telefones: juntar([a.telefone ?? ESC.telefone, a.whatsapp ? `WhatsApp ${a.whatsapp}` : null], ' · '),
    contato: juntar([emailContato, ESC.site], ' · '),
  };

  const texto = [a.nome, linhas.cargo, ESC.nome, ESC.registro, linhas.endereco, linhas.telefones, linhas.contato].filter(Boolean).join('\n');

  // 1) Imagem pronta da pessoa. O texto alternativo aparece quando o leitor bloqueia imagens.
  const arquivoImagem = a.imagem ?? null;
  const imagem = arquivoImagem ? await lerArquivo(caminhoImagem(arquivoImagem)) : null;
  if (arquivoImagem && imagem) {
    const mimeType = tipoImagem(arquivoImagem);
    const alt = escaparHtml(juntar([a.nome, a.cargo, ESC.nome, linhas.telefones], ' — '));
    const src = srcLogo === 'data-url' ? dataUrl(imagem, mimeType) : `cid:${CID_IMAGEM}`;
    return {
      html: `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px"><tr><td><img src="${src}" alt="${alt}" width="${LARGURA_IMAGEM_ASSINATURA}" style="display:block;border:0;max-width:100%;height:auto;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#324067"></td></tr></table>`,
      texto,
      imagem: srcLogo === 'data-url' ? null : { nome: `assinatura${path.extname(arquivoImagem).toLowerCase()}`, conteudo: imagem, mimeType, cid: CID_IMAGEM },
    };
  }
  if (arquivoImagem) console.warn(`[assinatura] imagem não encontrada (${caminhoImagem(arquivoImagem)}); usando a assinatura em texto.`);

  // 2) Sem imagem: assinatura em texto com o logo do escritório.
  const logo = ESC.logo ? await lerArquivo(ESC.logo) : null;
  const div = (conteudo: string, estilo = '') => (conteudo ? `<div style="${estilo}">${escaparHtml(conteudo)}</div>` : '');
  const cor = ESC.corPrincipal;
  const src = logo ? (srcLogo === 'data-url' ? dataUrl(logo, 'image/png') : `cid:${CID_LOGO}`) : null;

  const html = [
    '<table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;line-height:1.45">',
    '<tr>',
    src
      ? `<td style="padding-right:14px;border-right:2px solid ${cor};vertical-align:middle"><img src="${src}" alt="${escaparHtml(ESC.nome)}" width="110" style="display:block;border:0"></td>`
      : '',
    `<td style="${src ? 'padding-left:14px;' : `border-left:3px solid ${cor};padding-left:10px;`}vertical-align:top">`,
    div(a.nome, `font-weight:bold;font-size:14px;color:${cor}`),
    div(linhas.cargo),
    div(ESC.nome, 'margin-top:6px;font-weight:bold'),
    div(ESC.registro, 'font-size:12px;color:#666666'),
    div(linhas.endereco),
    div(linhas.telefones),
    div(linhas.contato),
    '</td></tr></table>',
  ].join('');

  return {
    html,
    texto,
    imagem: logo && srcLogo !== 'data-url' ? { nome: 'logo-dam.png', conteudo: logo, mimeType: 'image/png', cid: CID_LOGO } : null,
  };
}

// Página HTML para conferir a assinatura no navegador.
export async function previa(id: string): Promise<string> {
  const { html } = await montarAssinatura(await obter(id), 'data-url');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Prévia da assinatura</title></head><body style="margin:24px;background:#fff"><p style="font-family:Arial;font-size:14px;color:#222">Prezados,<br><br>Texto do e-mail…</p>${html}</body></html>`;
}

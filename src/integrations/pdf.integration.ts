import { PDFDocument } from 'pdf-lib';
import { extractText, getDocumentProxy } from 'unpdf';

// Extrai o texto de um PDF (equivale ao nó "Extract from File" do n8n).
// PDF escaneado (só imagem) volta com texto vazio.
export async function extrairTexto(conteudo: Buffer): Promise<{ paginas: number; texto: string }> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { paginas: totalPages, texto: text };
}

export async function contarPaginas(conteudo: Buffer): Promise<number> {
  const pdf = await PDFDocument.load(conteudo, { ignoreEncryption: true });
  return pdf.getPageCount();
}

// Copia as páginas indicadas (começando em 1), na ordem recebida, para um PDF novo.
// Substitui o recorte que o n8n fazia com o code interpreter da OpenAI.
export async function recortarPaginas(conteudo: Buffer, paginas: number[]): Promise<Buffer> {
  const original = await PDFDocument.load(conteudo, { ignoreEncryption: true });
  const total = original.getPageCount();
  const fora = paginas.filter((p) => p < 1 || p > total);
  if (fora.length) {
    throw new Error(`páginas fora do PDF (total ${total}): ${fora.join(', ')}`);
  }
  const novo = await PDFDocument.create();
  const copiadas = await novo.copyPages(original, paginas.map((p) => p - 1));
  copiadas.forEach((pagina) => novo.addPage(pagina));
  const recortado = Buffer.from(await novo.save());

  // Confere o resultado, como o n8n pedia ao code interpreter.
  if ((await contarPaginas(recortado)) !== paginas.length) {
    throw new Error('o PDF recortado não tem a quantidade de páginas esperada');
  }
  return recortado;
}

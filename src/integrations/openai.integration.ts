import { config } from '@/config/env.config';
import { AppError } from '@/errors/app.errors';
import { lerJsonDaIa } from '@/utils/json-ia.util';

export interface ArquivoParaIa {
  nome: string;
  conteudo: Buffer;
}

interface PedidoJson {
  modelo: string;
  instrucoes: string; // "system message"
  texto: string; // mensagem do usuário
  arquivo?: ArquivoParaIa; // PDF ou imagem anexado à mensagem
}

const TIPOS_IMAGEM: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// Diz se o arquivo pode ser enviado à IA (PDF ou imagem).
export function formatoAceitoPelaIa(nome: string): boolean {
  const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
  return extensao === 'pdf' || extensao in TIPOS_IMAGEM;
}

function montarArquivo(arquivo: ArquivoParaIa) {
  const extensao = arquivo.nome.split('.').pop()?.toLowerCase() ?? '';
  const base64 = arquivo.conteudo.toString('base64');
  if (extensao === 'pdf') {
    return { type: 'input_file', filename: arquivo.nome, file_data: `data:application/pdf;base64,${base64}` };
  }
  const tipo = TIPOS_IMAGEM[extensao];
  if (!tipo) throw new AppError(`Formato não aceito pela IA: ${arquivo.nome}`, 422);
  return { type: 'input_image', image_url: `data:${tipo};base64,${base64}` };
}

// Chama a OpenAI (Responses API) e devolve o JSON da resposta já convertido em objeto.
export async function gerarJson(pedido: PedidoJson): Promise<Record<string, unknown>> {
  const { chave, url } = config.openai;

  const conteudo: unknown[] = [];
  if (pedido.arquivo) conteudo.push(montarArquivo(pedido.arquivo));
  conteudo.push({ type: 'input_text', text: pedido.texto });
  // Com text.format json_object, a OpenAI exige a palavra "json" na mensagem do usuário (as instruções não contam).
  if (!/json/i.test(pedido.texto)) conteudo.push({ type: 'input_text', text: 'Responda somente com um objeto JSON válido.' });

  let resposta: Response;
  try {
    resposta = await fetch(`${url}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: pedido.modelo,
        instructions: pedido.instrucoes,
        input: [{ role: 'user', content: conteudo }],
        text: { format: { type: 'json_object' } },
      }),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (erro) {
    throw new AppError(`Falha de conexão com a OpenAI: ${(erro as Error).message}`, 502);
  }

  const corpo = (await resposta.json().catch(() => ({}))) as {
    error?: { message?: string };
    status?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };

  if (!resposta.ok || corpo.error) {
    throw new AppError(`OpenAI: ${corpo.error?.message ?? `status ${resposta.status}`}`, 502);
  }

  const textos = (corpo.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((parte) => parte.type === 'output_text')
    .map((parte) => parte.text ?? '');

  if (textos.length === 0) {
    throw new AppError(`OpenAI não devolveu texto (status: ${corpo.status ?? 'desconhecido'}).`, 502);
  }

  try {
    return lerJsonDaIa(textos.join(''));
  } catch (erro) {
    throw new AppError(`Resposta da IA inválida: ${(erro as Error).message}`, 502);
  }
}

// ---------- Conversa com ferramentas (usada pela DEX) ----------

export interface FerramentaIa {
  nome: string;
  descricao: string;
  parametros: Record<string, unknown>; // JSON Schema dos argumentos
}

interface ItemSaida {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  content?: { type?: string; text?: string }[];
}

// Conversa em que a IA pode chamar funções do sistema; repete até ela dar a resposta final.
export async function conversarComFerramentas(pedido: {
  modelo: string;
  instrucoes: string;
  mensagens: { role: 'user' | 'assistant'; content: string }[];
  ferramentas: FerramentaIa[];
  executar: (nome: string, argumentos: Record<string, unknown>) => Promise<unknown>;
  maxRodadas?: number;
}): Promise<{ texto: string; ferramentasUsadas: string[] }> {
  const { chave, url } = config.openai;
  const entrada: unknown[] = [...pedido.mensagens];
  const usadas: string[] = [];

  for (let rodada = 0; rodada < (pedido.maxRodadas ?? 6); rodada++) {
    let resposta: Response;
    try {
      resposta = await fetch(`${url}/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: pedido.modelo,
          instructions: pedido.instrucoes,
          input: entrada,
          tools: pedido.ferramentas.map((f) => ({ type: 'function', name: f.nome, description: f.descricao, parameters: f.parametros })),
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (erro) {
      throw new AppError(`Falha de conexão com a OpenAI: ${(erro as Error).message}`, 502);
    }
    const corpo = (await resposta.json().catch(() => ({}))) as { error?: { message?: string }; output?: ItemSaida[] };
    if (!resposta.ok || corpo.error) throw new AppError(`OpenAI: ${corpo.error?.message ?? `status ${resposta.status}`}`, 502);

    const saida = corpo.output ?? [];
    const chamadas = saida.filter((item) => item.type === 'function_call');
    if (!chamadas.length) {
      const texto = saida
        .filter((item) => item.type === 'message')
        .flatMap((item) => item.content ?? [])
        .filter((parte) => parte.type === 'output_text')
        .map((parte) => parte.text ?? '')
        .join('')
        .trim();
      return { texto: texto || 'Não consegui formular uma resposta agora. Pode reformular a pergunta?', ferramentasUsadas: [...new Set(usadas)] };
    }

    entrada.push(...saida); // devolve as chamadas (e o raciocínio, se houver) para a próxima rodada
    for (const chamada of chamadas) {
      usadas.push(chamada.name ?? '');
      let resultado: unknown;
      try {
        resultado = await pedido.executar(chamada.name ?? '', JSON.parse(chamada.arguments || '{}'));
      } catch (erro) {
        resultado = { erro: (erro as Error).message };
      }
      entrada.push({ type: 'function_call_output', call_id: chamada.call_id, output: JSON.stringify(resultado).slice(0, 60_000) });
    }
  }
  return { texto: 'Precisei de consultas demais para essa pergunta. Pode ser mais específico?', ferramentasUsadas: [...new Set(usadas)] };
}

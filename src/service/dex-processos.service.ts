import {
  buscarProcessos,
  listarEventosDoProcesso,
  listarMovimentacoesRecentes,
  listarPrazosDoProcesso,
  listarPublicacoesDoProcesso,
  obterProcessoCompleto,
} from '@/integrations/lawyertool.integration';
import { apenasDigitos } from '@/utils/cnpj.util';
import { textoDeHtml } from '@/utils/texto.util';

// Consulta de processos no Lawyertool para a DEX. SÓ LEITURA: nada aqui altera o Lawyertool.
// Dados pessoais (CPF, telefone, e-mail, endereço) NÃO são devolvidos à IA.

type Registro = Record<string, unknown>;

const LIMITE_TEXTO_MOVIMENTO = 700;
const PRAZO_FECHADO = /fechad|cumprid|cancelad|baixad|conclu/i;

function campo(registro: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((atual, chave) => (atual && typeof atual === 'object' ? (atual as Registro)[chave] : undefined), registro);
}

function texto(registro: unknown, caminho: string): string | null {
  const valor = campo(registro, caminho);
  const limpo = typeof valor === 'string' ? valor.trim() : valor == null ? '' : String(valor);
  return limpo && limpo !== '—' ? limpo : null;
}

// 50013028720214047212 -> 5001302-87.2021.4.04.7212
export function formatarCnj(numero: unknown): string | null {
  const digitos = apenasDigitos(numero);
  if (!digitos) return null;
  if (digitos.length !== 20) return String(numero);
  return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16)}`;
}

function cortar(valor: string, limite: number): string {
  return valor.length > limite ? `${valor.slice(0, limite).trimEnd()}… [cortado]` : valor;
}

function hojeIso(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
}

// Uma parte que falha (ex.: rota de eventos indisponível) não derruba a consulta inteira.
async function parte<T>(nome: string, consulta: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await consulta();
  } catch (erro) {
    console.error(`[dex] falha ao consultar ${nome}:`, erro);
    return { erro: `Não foi possível consultar ${nome} no Lawyertool agora.` };
  }
}

export async function procurarProcessos(args: { numero?: unknown; cliente?: unknown; cpf?: unknown }) {
  const numero = apenasDigitos(args.numero);
  const cliente = String(args.cliente ?? '').trim();
  const cpf = apenasDigitos(args.cpf);
  if (!numero && cliente.length < 3 && cpf.length < 6) {
    return { erro: 'Informe o número do processo, o nome do cliente (mínimo 3 letras) ou o CPF.' };
  }

  const resposta = await buscarProcessos({ numero: numero || undefined, cliente: cliente || undefined, cpf: cpf || undefined, limite: 15 });
  const processos = (resposta.data ?? []).map((p) => ({
    processoId: p.id,
    numero: formatarCnj(p.numeroProcesso) ?? 'sem número (administrativo/pasta)',
    cliente: texto(p, 'emitente.nome'),
    tipo: texto(p, 'tipoProcesso.descricao'),
    procedimento: texto(p, 'procedimento.descricao'),
    status: texto(p, 'status.descricao'),
    situacao_pasta: texto(p, 'situacaoPasta.descricao'),
    local_pasta: texto(p, 'localPasta.descricao'),
    ultima_alteracao: texto(p, 'dataAlt'),
  }));
  return {
    total_encontrado: resposta.total ?? processos.length,
    mostrando: processos.length,
    processos,
    observacao:
      processos.length > 1
        ? 'Mais de um processo encontrado. Se a pergunta não deixar claro qual é, liste-os e pergunte qual a pessoa quer.'
        : processos.length === 0
          ? 'Nenhum processo encontrado com esse critério.'
          : null,
  };
}

export async function andamentoProcesso(args: { processoId?: unknown; movimentacoes?: unknown }) {
  const processoId = Number(args.processoId);
  if (!Number.isInteger(processoId) || processoId <= 0) return { erro: 'processoId inválido. Use buscar_processo antes.' };
  const quantidade = Math.min(Math.max(Number(args.movimentacoes) || 8, 1), 25);

  const processo = await obterProcessoCompleto(processoId);
  if (!processo) return { encontrado: false };

  const [movimentos, prazos, eventos, publicacoes] = await Promise.all([
    parte('as movimentações', () => listarMovimentacoesRecentes(processoId, quantidade)),
    parte('os prazos', () => listarPrazosDoProcesso(processoId)),
    parte('os eventos (audiências/perícias)', () => listarEventosDoProcesso(processoId)),
    parte('as publicações', () => listarPublicacoesDoProcesso(processoId)),
  ]);
  const hoje = hojeIso();

  const listaPrazos = 'erro' in prazos ? null : (prazos.data ?? []).map((p) => ({
    descricao: cortar(textoDeHtml(p.descricao), 500),
    tipo: texto(p, 'tipoPrazo.descricao'),
    inicio: texto(p, 'dataIni'),
    vencimento: texto(p, 'dataFim'),
    status: texto(p, 'status.descricao'),
    responsavel: texto(p, 'usuarioResponsavel.nome'),
  }));
  const listaEventos = 'erro' in eventos ? null : (eventos.data ?? []).map((e) => ({
    data: texto(e, 'dataEvento'),
    hora: texto(e, 'horaEvento'),
    tipo: texto(e, 'tipoEvento.descricao'),
    situacao: texto(e, 'situacaoEvento.descricao'),
    cidade: texto(e, 'cidadeEvento.nome'),
    responsavel: texto(e, 'usuarioResponsavel.nome'),
  }));

  return {
    hoje,
    processo: {
      processoId,
      numero: formatarCnj(processo.numeroProcesso) ?? 'sem número (administrativo/pasta)',
      cliente: texto(processo, 'emitente.nome'),
      tipo: texto(processo, 'tipoProcesso.descricao'),
      procedimento: texto(processo, 'procedimento.descricao'),
      status: texto(processo, 'status.descricao'),
      situacao_pasta: texto(processo, 'situacaoPasta.descricao'),
      local_pasta: texto(processo, 'localPasta.descricao'),
      local_setor: texto(processo, 'localSetor'),
      alerta: texto(processo, 'alerta'),
      observacoes: texto(processo, 'obs') ? cortar(textoDeHtml(processo.obs), 500) : null,
      der: texto(processo, 'dataDer'),
      dib: texto(processo, 'dataDib'),
      ajuizamento: texto(processo, 'dataAjuizamento'),
      implantacao: texto(processo, 'dataImplantacao'),
      numero_beneficio: texto(processo, 'numeroBeneficio'),
    },
    ultimas_movimentacoes:
      'erro' in movimentos
        ? movimentos
        : (movimentos.data ?? []).map((m) => ({
            data: texto(m, 'dataCad'),
            tipo: texto(m, 'tipoMovimento.descricao'),
            status: texto(m, 'status.descricao'),
            texto: cortar(textoDeHtml(m.descricao), LIMITE_TEXTO_MOVIMENTO),
          })),
    // Fechado = cumprido; a descrição do prazo fechado costuma dizer o que foi feito.
    prazos_em_aberto: listaPrazos
      ? listaPrazos.filter((p) => !PRAZO_FECHADO.test(p.status ?? '')).map((p) => ({ ...p, vencido: (p.vencimento ?? '') < hoje }))
      : prazos,
    prazos_fechados_recentes: listaPrazos ? listaPrazos.filter((p) => PRAZO_FECHADO.test(p.status ?? '')).slice(0, 5) : null,
    eventos_futuros: listaEventos ? listaEventos.filter((e) => (e.data ?? '') >= hoje) : eventos,
    eventos_passados: listaEventos ? listaEventos.filter((e) => (e.data ?? '') < hoje).slice(0, 3) : null,
    ultimas_publicacoes:
      'erro' in publicacoes
        ? publicacoes
        : (publicacoes.data ?? []).map((p) => ({
            data: texto(p, 'dataDisponibilizacao'),
            tribunal: texto(p, 'siglaTribunal'),
            tipo: texto(p, 'tipoComunicacao'),
            orgao: texto(p, 'nomeOrgao'),
            tratada: p.foiTratada ?? null,
          })),
  };
}

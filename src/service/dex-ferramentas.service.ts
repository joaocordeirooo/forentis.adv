import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FerramentaIa } from '@/integrations/openai.integration';
import { buscarContatosPorEmpresa } from '@/repositories/contato-empresa.repository';
import { obterEstado } from '@/repositories/estado-tarefa.repository';
import { listarExecucoes, obterExecucao } from '@/repositories/execucao.repository';
import { listarSolicitacoes, obterSolicitacao } from '@/repositories/solicitacao.repository';
import { normalizar } from '@/utils/texto.util';
import { atendentesDasTarefas, concluirTarefaAtendimento, tarefasAtendimentoDaSemana } from './atendimento-lawyertool.service';
import { semanaAtual } from '@/utils/semana.util';
import { andamentoProcesso, procurarProcessos } from './dex-processos.service';
import { montarRelatorio } from './relatorio.service';

// Ferramentas da DEX. Todas são SÓ DE LEITURA, com UMA exceção: concluir_tarefa_atendimento,
// que conclui tarefa do Atendimento Externo no Lawyertool quando o próprio atendente informa que cumpriu
// (com travas no servidor: tipo de atendimento, situação aberta e responsável liberado no .env).

export interface ContextoDex {
  pessoa: string | null; // nome informado no chat (ainda sem login)
}

const objeto = (propriedades: Record<string, unknown> = {}, obrigatorios: string[] = []) => ({
  type: 'object',
  properties: propriedades,
  required: obrigatorios,
  additionalProperties: false,
});

export const FERRAMENTAS_DEX: FerramentaIa[] = [
  { nome: 'resumo_geral', descricao: 'Panorama do sistema: solicitações por situação, última execução da análise e atendimento externo da semana.', parametros: objeto() },
  {
    nome: 'listar_solicitacoes',
    descricao: 'Lista solicitações de documentos (ao cliente ou a empresas). Filtros opcionais por situação, tipo e texto (cliente, empresa ou número da tarefa).',
    parametros: objeto({
      status: { type: 'string', enum: ['aguardando_conferencia', 'bloqueada', 'concluida', 'falha_envio', 'descartada', 'substituida'] },
      tipo: { type: 'string', enum: ['cliente', 'empresa'] },
      busca: { type: 'string' },
    }),
  },
  {
    nome: 'detalhar_solicitacao',
    descricao: 'Detalhes de uma solicitação: texto, destinatário, pendências com as fontes, bloqueios, avisos, anexos e histórico. Informe o id da solicitação ou o número da tarefa do Lawyertool.',
    parametros: objeto({ id: { type: 'string' }, tarefaId: { type: 'integer' } }),
  },
  {
    nome: 'execucoes_analise',
    descricao: 'Execuções da análise automática. Sem id: lista as últimas. Com id (ou "ultima"): relatório completo, com as tarefas não tratadas e o motivo de cada uma.',
    parametros: objeto({ id: { type: 'string' } }),
  },
  {
    nome: 'consultar_tarefa',
    descricao: 'O que a automação já fez com uma tarefa do Lawyertool: última análise, decisão, triagem, motivos e solicitações preparadas.',
    parametros: objeto({ tarefaId: { type: 'integer' } }, ['tarefaId']),
  },
  {
    nome: 'tarefas_atendimento',
    descricao:
      'Tarefas REAIS do Atendimento Externo no Lawyertool (todos os setores) de um funcionário: todas as abertas (atrasadas, da semana e das próximas semanas) e as concluídas, com tarefaId, cliente, cidade, tipo, data final esperada e situação. Sem "funcionario", usa a pessoa que está conversando. Sem nada que bata, devolve a lista de funcionários com tarefas.',
    parametros: objeto({ funcionario: { type: 'string', description: 'Nome (ou parte) do funcionário responsável.' }, semana: { type: 'string', description: 'Qualquer data da semana desejada (AAAA-MM-DD). Padrão: semana atual.' } }),
  },
  {
    nome: 'concluir_tarefa_atendimento',
    descricao:
      'ALTERA o Lawyertool: conclui UMA tarefa do Atendimento Externo e registra o relato em comentário. Use somente quando o atendente disser que cumpriu (atendeu o cliente, entregou, colheu a assinatura etc.) e a tarefa estiver identificada sem dúvida: pelo número que a própria pessoa informou ou pelo tarefaId vindo de tarefas_atendimento. O sistema confere tipo, situação e responsável.',
    parametros: objeto(
      { tarefaId: { type: 'integer' }, relato: { type: 'string', description: 'O que o atendente disse que foi feito, em uma ou duas frases.' } },
      ['tarefaId', 'relato'],
    ),
  },
  {
    nome: 'buscar_contato_empresa',
    descricao: 'Procura o contato de uma empresa na tabela interna de contatos (importada do n8n).',
    parametros: objeto({ nome: { type: 'string' } }, ['nome']),
  },
  {
    nome: 'buscar_processo',
    descricao:
      'Procura processos no Lawyertool pelo número (CNJ, com ou sem máscara, ou parte dele), pelo nome do cliente (ou parte) ou pelo CPF. Devolve processoId, número, cliente, tipo, status e situação da pasta. Use antes de andamento_processo.',
    parametros: objeto({ numero: { type: 'string' }, cliente: { type: 'string' }, cpf: { type: 'string' } }),
  },
  {
    nome: 'andamento_processo',
    descricao:
      'Andamento de UM processo do Lawyertool (pelo processoId de buscar_processo): dados do processo, últimas movimentações (mais recentes primeiro), prazos em aberto, audiências/perícias e últimas publicações.',
    parametros: objeto(
      { processoId: { type: 'integer' }, movimentacoes: { type: 'integer', description: 'Quantas movimentações trazer (padrão 8, máximo 25).' } },
      ['processoId'],
    ),
  },
  { nome: 'consultar_guia', descricao: 'Guia de funcionamento do sistema (regras, travas, rotas, configurações). Use para dúvidas de "como funciona".', parametros: objeto() },
];

function resumoSolicitacao(s: Awaited<ReturnType<typeof listarSolicitacoes>>[number]) {
  return {
    id: s.id,
    tipo: s.tipo,
    status: s.status,
    cliente: s.clienteNome,
    empresa: s.empresa,
    tarefaId: s.tarefaId,
    criadaEm: s.criadaEm,
    bloqueios: s.bloqueios,
    pendencias: s.pendencias.map((p) => p.documento),
  };
}

export async function executarFerramentaDex(nome: string, args: Record<string, unknown>, contexto: ContextoDex = { pessoa: null }): Promise<unknown> {
  switch (nome) {
    case 'resumo_geral': {
      const solicitacoes = await listarSolicitacoes();
      const porStatus: Record<string, number> = {};
      for (const s of solicitacoes) porStatus[`${s.tipo}:${s.status}`] = (porStatus[`${s.tipo}:${s.status}`] ?? 0) + 1;
      const ultima = (await listarExecucoes())[0];
      const demanda = await tarefasAtendimentoDaSemana(semanaAtual()).catch(() => null);
      return {
        hoje: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        solicitacoes_por_tipo_e_situacao: porStatus,
        ultima_execucao: ultima
          ? { id: ultima.id, status: ultima.status, iniciada: ultima.iniciadaEm, processadas: ultima.tarefasProcessadas, nao_tratadas: ultima.resultados.filter((r) => !r.tratada).length, erro: ultima.erro }
          : null,
        atendimento_externo_semana: demanda
          ? atendentesDasTarefas(demanda.tarefas, demanda.nomes).map((a) => ({ funcionario: a.nome, abertas: a.abertas }))
          : 'Não foi possível consultar o Lawyertool agora.',
      };
    }
    case 'listar_solicitacoes': {
      const termo = normalizar(args.busca);
      const lista = (await listarSolicitacoes({ status: args.status as never, tipo: args.tipo as never }))
        .filter((s) => !termo || normalizar(`${s.clienteNome} ${s.empresa} ${s.tarefaId}`).includes(termo));
      return { total: lista.length, solicitacoes: lista.slice(0, 30).map(resumoSolicitacao) };
    }
    case 'detalhar_solicitacao': {
      let s = args.id ? await obterSolicitacao(String(args.id)) : null;
      if (!s && args.tarefaId) s = (await listarSolicitacoes({ tarefaId: Number(args.tarefaId) }))[0] ?? null;
      if (!s) return { encontrado: false };
      const { detalhes, ...resto } = s;
      return { ...resto, contatos: detalhes.contatos ?? null, decisao_avaliacao: detalhes.decisao_avaliacao ?? null };
    }
    case 'execucoes_analise': {
      const lista = await listarExecucoes();
      if (!args.id) {
        return lista.slice(0, 10).map((e) => ({ id: e.id, status: e.status, origem: e.origem, iniciada: e.iniciadaEm, processadas: e.tarefasProcessadas, nao_tratadas: e.resultados.filter((r) => !r.tratada).length }));
      }
      const execucao = args.id === 'ultima' ? lista[0] : await obterExecucao(String(args.id));
      if (!execucao) return { encontrado: false };
      const relatorio = montarRelatorio(execucao);
      return { id: execucao.id, status: execucao.status, iniciada: execucao.iniciadaEm, erro: execucao.erro, tratadas: relatorio.tratadas, total: relatorio.total, nao_tratadas: relatorio.naoTratadas };
    }
    case 'consultar_tarefa': {
      const tarefaId = Number(args.tarefaId);
      const estado = await obterEstado(tarefaId);
      const solicitacoes = (await listarSolicitacoes({ tarefaId })).map(resumoSolicitacao);
      return { tarefaId, ja_analisada: Boolean(estado), estado, solicitacoes };
    }
    case 'tarefas_atendimento':
      return tarefasAtendimentoDoFuncionario(String(args.funcionario ?? '') || contexto.pessoa || '', args.semana ? String(args.semana) : null);
    case 'concluir_tarefa_atendimento':
      return concluirTarefaAtendimento({ tarefaId: Number(args.tarefaId), relato: String(args.relato ?? ''), informadoPor: contexto.pessoa });
    case 'buscar_contato_empresa': {
      const { contatos, exato, ambiguos } = await buscarContatosPorEmpresa(String(args.nome ?? ''));
      return {
        exato,
        ambiguos,
        contatos: contatos.slice(0, 10).map((c) => ({ empresa: c.empresa, contato: c.contatoNome, email: c.email, telefone: c.telefone, cidade: c.cidade, observacao: c.observacao })),
      };
    }
    case 'buscar_processo':
      return procurarProcessos(args);
    case 'andamento_processo':
      return andamentoProcesso(args);
    case 'consultar_guia': {
      try {
        return await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), 'docs', 'guia-backend.md'), 'utf8');
      } catch {
        return 'Guia não encontrado.';
      }
    }
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}


// Tarefas de atendimento de um funcionário, achado pelo nome (ou parte).
async function tarefasAtendimentoDoFuncionario(nome: string, semanaRef: string | null) {
  const semana = semanaRef && /^\d{4}-\d{2}-\d{2}$/.test(semanaRef) ? semanaAtual(new Date(`${semanaRef}T12:00:00-03:00`)) : semanaAtual();
  // Abertas: tudo até 60 dias depois do fim da semana (o atendente pode adiantar uma tarefa da semana seguinte).
  const limite = new Date(`${semana.fim}T12:00:00-03:00`);
  limite.setDate(limite.getDate() + 60);
  const demanda = await tarefasAtendimentoDaSemana({ inicio: semana.inicio, fim: limite.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) });
  const atendentes = atendentesDasTarefas(demanda.tarefas, demanda.nomes);
  const termo = normalizar(nome);
  const achados = termo ? atendentes.filter((a) => normalizar(a.nome).includes(termo) || termo.includes(normalizar(a.nome))) : [];
  const funcionarios = atendentes.map((a) => ({ nome: a.nome, abertas: a.abertas, conclusao_liberada: a.liberado }));
  if (achados.length !== 1) {
    return {
      semana,
      encontrado: false,
      observacao: achados.length > 1 ? 'Mais de um funcionário com esse nome: pergunte qual.' : 'Não identifiquei o funcionário: pergunte o nome.',
      funcionarios: achados.length > 1 ? funcionarios.filter((f) => achados.some((a) => a.nome === f.nome)) : funcionarios,
    };
  }
  const atendente = achados[0];
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return {
    semana,
    hoje,
    funcionario: atendente.nome,
    conclusao_liberada: atendente.liberado,
    tarefas: demanda.tarefas
      .filter((t) => t.atendenteId === atendente.id)
      .map((t) => ({
        tarefaId: t.tarefaId,
        cliente: t.cliente,
        cidade: t.cidade,
        setor: t.setor,
        tipo: t.tipo,
        descricao: t.descricao.slice(0, 300),
        data_final_esperada: t.prazo,
        situacao: t.situacao,
        atrasada: t.situacao !== 'concluida' && t.prazo < hoje,
        desta_semana: t.prazo >= semana.inicio && t.prazo <= semana.fim,
        pode_concluir_pela_dex: t.situacao !== 'concluida' && t.tarefaFinal !== false,
      })),
  };
}

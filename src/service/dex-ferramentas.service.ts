import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ATENDENTE_TESTE } from '@/config/atendimento.config';
import type { FerramentaIa } from '@/integrations/openai.integration';
import { buscarContatosPorEmpresa } from '@/repositories/contato-empresa.repository';
import { obterEstado } from '@/repositories/estado-tarefa.repository';
import { listarExecucoes, obterExecucao } from '@/repositories/execucao.repository';
import { listarSolicitacoes, obterSolicitacao } from '@/repositories/solicitacao.repository';
import { normalizar } from '@/utils/texto.util';
import { tarefasDaSemana } from './atendimento.service';
import { montarRelatorio } from './relatorio.service';

// Ferramentas SÓ DE LEITURA que a DEX pode usar. Nenhuma altera dados.

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
  { nome: 'atendimento_semana', descricao: 'Tarefas do atendimento externo da semana (pendentes e iniciadas), por setor e dia.', parametros: objeto() },
  {
    nome: 'buscar_contato_empresa',
    descricao: 'Procura o contato de uma empresa na tabela interna de contatos (importada do n8n).',
    parametros: objeto({ nome: { type: 'string' } }, ['nome']),
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

export async function executarFerramentaDex(nome: string, args: Record<string, unknown>): Promise<unknown> {
  switch (nome) {
    case 'resumo_geral': {
      const solicitacoes = await listarSolicitacoes();
      const porStatus: Record<string, number> = {};
      for (const s of solicitacoes) porStatus[`${s.tipo}:${s.status}`] = (porStatus[`${s.tipo}:${s.status}`] ?? 0) + 1;
      const ultima = (await listarExecucoes())[0];
      const atendimento = await tarefasDaSemana(ATENDENTE_TESTE.id);
      return {
        hoje: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        solicitacoes_por_tipo_e_situacao: porStatus,
        ultima_execucao: ultima
          ? { id: ultima.id, status: ultima.status, iniciada: ultima.iniciadaEm, processadas: ultima.tarefasProcessadas, nao_tratadas: ultima.resultados.filter((r) => !r.tratada).length, erro: ultima.erro }
          : null,
        atendimento_semana: {
          atendente: atendimento.atendente.nome,
          pendentes: atendimento.tarefas.filter((t) => t.situacao === 'pendente').length,
          iniciadas: atendimento.tarefas.filter((t) => t.situacao === 'iniciada').length,
          exemplos: atendimento.tarefas.some((t) => t.exemplo),
        },
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
    case 'atendimento_semana': {
      const semana = await tarefasDaSemana(ATENDENTE_TESTE.id);
      return {
        atendente: semana.atendente,
        semana: semana.semana,
        observacao: semana.tarefas.some((t) => t.exemplo) ? 'Tarefas de EXEMPLO (fictícias), para teste.' : null,
        tarefas: semana.tarefas.map((t) => ({ setor: t.setor, tipo: t.tipo, cliente: t.cliente, cidade: t.cidade, prazo: t.prazo, situacao: t.situacao, descricao: t.descricao })),
      };
    }
    case 'buscar_contato_empresa': {
      const { contatos, exato, ambiguos } = await buscarContatosPorEmpresa(String(args.nome ?? ''));
      return {
        exato,
        ambiguos,
        contatos: contatos.slice(0, 10).map((c) => ({ empresa: c.empresa, contato: c.contatoNome, email: c.email, telefone: c.telefone, cidade: c.cidade, observacao: c.observacao })),
      };
    }
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


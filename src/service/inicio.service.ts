import { ATENDENTE_TESTE } from '@/config/atendimento.config';
import { listarExecucoes } from '@/repositories/execucao.repository';
import { listarSolicitacoes } from '@/repositories/solicitacao.repository';
import { tarefasDaSemana } from './atendimento.service';

// Números leves para os cartões da página Início (não consulta o Lawyertool).
export async function resumoInicio() {
  const solicitacoes = await listarSolicitacoes();
  const ultima = (await listarExecucoes())[0] ?? null;
  const atendimento = await tarefasDaSemana(ATENDENTE_TESTE.id);
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const pendentes = atendimento.tarefas.filter((t) => t.situacao === 'pendente');

  return {
    documentos: {
      aguardando: solicitacoes.filter((s) => s.status === 'aguardando_conferencia').length,
      bloqueadas: solicitacoes.filter((s) => s.status === 'bloqueada').length,
      falhas: solicitacoes.filter((s) => s.status === 'falha_envio').length,
      enviadasHoje: solicitacoes.filter((s) => s.status === 'concluida' && s.conclusao?.em.slice(0, 10) === hoje).length,
      ultimaExecucao: ultima
        ? { status: ultima.status, iniciadaEm: ultima.iniciadaEm, naoTratadas: ultima.resultados.filter((r) => !r.tratada).length }
        : null,
    },
    atendimento: {
      atendente: atendimento.atendente.nome,
      pendentes: pendentes.length,
      hoje: pendentes.filter((t) => t.prazo === hoje).length,
      atrasadas: pendentes.filter((t) => t.prazo < hoje).length,
      iniciadas: atendimento.tarefas.filter((t) => t.situacao === 'iniciada').length,
    },
  };
}

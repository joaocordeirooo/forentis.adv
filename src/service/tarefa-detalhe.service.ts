import { AppError } from '@/errors/app.errors';
import { listarComentariosTarefa, listarHistoricoTarefa, obterTarefaCompleta } from '@/integrations/lawyertool.integration';
import type { TarefaDetalhe } from '@/models/tarefa-detalhe.model';
import { listarSolicitacoes } from '@/repositories/solicitacao.repository';
import { textoComLinhasDeHtml } from '@/utils/texto.util';

// Monta a tarefa "na íntegra" para o Forentis mostrar igual à tela do Lawyertool.
// Só leva o que a tela mostra: não repassa CPF, RG e outros dados do cadastro da pessoa.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const ref = (v: unknown, campo = 'descricao') => {
  const o = obj(v);
  const id = Number(o?.id);
  if (!o || !Number.isFinite(id)) return null;
  return { id, nome: txt(o[campo]) ?? txt(o.nome) ?? txt(o.descricao) ?? `#${id}` };
};

const ROTULO_ACAO: Record<string, string> = {
  'acao.iniciar': 'Iniciou',
  'acao.concluir': 'Concluiu',
  'acao.bloquear': 'Bloqueou',
  'acao.cancelar': 'Cancelou',
  'acao.pendente': 'Voltou para pendente',
  'acao.alterar': 'Alterou',
  'acao.criar': 'Criou',
};
const rotuloCampo = (v: string | null) => (v ? v.replace(/^field\./, '').replace(/([A-Z])/g, ' $1').toLowerCase() : null);

export async function obterTarefaDetalhe(tarefaId: number): Promise<TarefaDetalhe> {
  const [tarefa, comentarios, historico, solicitacoes] = await Promise.all([
    obterTarefaCompleta(tarefaId),
    listarComentariosTarefa(tarefaId).catch((e: Error) => e),
    listarHistoricoTarefa(tarefaId).catch((e: Error) => e),
    listarSolicitacoes({ tarefaId }),
  ]);
  if (!tarefa?.id) throw new AppError(`Tarefa ${tarefaId} não encontrada no Lawyertool.`, 404);

  const avisos: string[] = [];
  if (comentarios instanceof Error) avisos.push(`Comentários não carregaram: ${comentarios.message}`);
  if (historico instanceof Error) avisos.push(`Histórico não carregou: ${historico.message}`);

  const processo = obj(tarefa.processo);
  const responsaveis = Array.isArray(tarefa.responsaveis)
    ? tarefa.responsaveis.map((r) => txt(obj(r)?.nome) ?? txt(obj(obj(r)?.usuario)?.nome)).filter((n): n is string => Boolean(n))
    : [];

  return {
    id: Number(tarefa.id),
    titulo: txt(tarefa.titulo),
    descricao: textoComLinhasDeHtml(tarefa.descricao),
    situacao: txt(tarefa.situacao),
    prioridade: txt(tarefa.prioridade),
    destaca: tarefa.destaca === true,
    atrasada: tarefa.atrasada === true,
    diasAtraso: typeof tarefa.diasAtraso === 'number' ? tarefa.diasAtraso : null,
    subtarefa: tarefa.subtarefa === true,
    tarefaPai: ref(tarefa.tarefaPai, 'titulo'),
    setor: ref(tarefa.setor),
    fluxo: ref(tarefa.fluxo),
    tipoTarefa: ref(tarefa.tipoTarefa),
    pessoa: ref(tarefa.emitente, 'nome'),
    processo: processo && Number.isFinite(Number(processo.id)) ? { id: Number(processo.id), numero: txt(processo.numeroProcesso) } : null,
    usuarioResponsavel: ref(tarefa.usuarioResponsavel, 'nome'),
    usuarioSolicitante: ref(tarefa.usuarioSolicitante, 'nome'),
    responsaveis,
    datas: {
      inicio: txt(tarefa.dataInicio),
      finalEsperada: txt(tarefa.dataFinalEsperada),
      finalReal: txt(tarefa.dataFinalReal),
      bloqueio: txt(tarefa.dataBloqueio),
      cadastro: txt(tarefa.dataCad),
      alteracao: txt(tarefa.dataAlt),
    },
    criadoPor: txt(tarefa.usuarioCad),
    alteradoPor: txt(tarefa.usuarioAlt),
    comentarios: comentarios instanceof Error
      ? []
      : (comentarios.data ?? []).map((c) => ({
          id: c.id,
          usuario: c.usuario?.nome ?? null,
          conteudo: textoComLinhasDeHtml(c.conteudo),
          em: c.dataCad ?? null,
        })),
    historico: historico instanceof Error
      ? []
      : (historico.data ?? []).map((h) => {
          const acao = txt(h.acao);
          return {
            id: Number(h.id),
            usuario: txt(obj(h.usuario)?.nome) ?? txt(h.usuarioCad),
            acao: acao ? ROTULO_ACAO[acao] ?? acao.replace(/^acao\./, '') : null,
            campo: rotuloCampo(txt(h.campo)),
            de: txt(h.valorAnterior),
            para: txt(h.valorNovo),
            descricao: txt(h.descricao),
            em: txt(h.dataAcao) ?? txt(h.dataCad),
          };
        }),
    solicitacoes: solicitacoes
      .filter((s) => s.status !== 'substituida')
      .map((s) => ({
        id: s.id,
        tipo: s.tipo,
        status: s.status,
        titulo: s.tipo === 'cliente' ? 'Mensagem ao cliente' : s.tipo === 'empresa' ? s.empresa ?? 'Empresa' : 'Pendências sem destinatário',
        criadaEm: s.criadaEm,
      })),
    avisos,
  };
}

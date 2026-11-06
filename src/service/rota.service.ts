import { randomUUID } from 'node:crypto';
import { BASE, CATEGORIAS_DESPESA, CIDADES, type CategoriaDespesa } from '@/config/rota.config';
import { obterPosicao, obterTrajetoDoDia } from '@/integrations/rastreador.integration';
import type { AcaoNova, Despesa, ParadaPainel, PontoTrajeto } from '@/models/rota.model';
import { listarAcoes, listarDespesas, removerDespesa, salvarAcao, salvarDespesa } from '@/repositories/rota.repository';
import { somaKm } from '@/utils/geo.util';
import { normalizar } from '@/utils/texto.util';
import { pastasPorCidadeExemplo } from './atendimento-exemplos.service';
import { tarefasDaSemana } from './atendimento.service';
import { agendaDoDia, cidadesDoDia } from './rastreador-simulado.service';

const hojeSp = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const chaveCidade = (nome: string | null) => Object.entries(CIDADES).find(([, c]) => normalizar(c.nome) === normalizar(nome))?.[0] ?? null;

// Reduz o trajeto para o mapa (no máximo ~1 ponto a cada 5 do original), mantendo início e fim.
function reduzir(pontos: PontoTrajeto[], maximo = 400): [number, number][] {
  const passo = Math.max(1, Math.ceil(pontos.length / maximo));
  const r = pontos.filter((_, i) => i % passo === 0 || i === pontos.length - 1);
  return r.map((p) => [Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5))]);
}

export async function posicao(atendenteId: string) {
  return obterPosicao(atendenteId);
}

// Tudo o que o painel de rota precisa, de uma vez.
export async function painelRota(atendenteId: string) {
  const { atendente, semana, tarefas } = await tarefasDaSemana(atendenteId);
  const hoje = hojeSp();
  const agora = new Date();
  const pastas = pastasPorCidadeExemplo();
  const posicaoAtual = await obterPosicao(atendenteId);
  // No simulado o trajeto é em linha quase reta; o fator aproxima a distância pela estrada. O rastreador real já mede a estrada.
  const fatorEstrada = posicaoAtual.fonte === 'simulado' ? 1.3 : 1;

  // Trajeto e km por dia (só dias até hoje).
  const dias = semana.diasUteis.filter((d) => d <= hoje);
  const trajetos: Record<string, PontoTrajeto[]> = {};
  for (const d of dias) trajetos[d] = await obterTrajetoDoDia(atendenteId, d);
  const kmDia = (d: string) => Math.round((trajetos[d] ? somaKm(trajetos[d]) : 0) * fatorEstrada);

  // Paradas: cidade × dia, com o que foi resolvido lá.
  const paradas: ParadaPainel[] = [];
  for (const data of semana.diasUteis) {
    const agenda = agendaDoDia(data, pastas);
    for (const chave of cidadesDoDia(data)) {
      const cidade = CIDADES[chave];
      const daCidade = tarefas.filter((t) => t.prazo === data && chaveCidade(t.cidade) === chave);
      const p = agenda.paradas.find((x) => x.chave === chave);
      paradas.push({
        chave,
        cidade: cidade.nome,
        uf: cidade.uf,
        lat: cidade.lat,
        lng: cidade.lng,
        data,
        chegada: p?.chegada.toISOString() ?? null,
        saida: p?.saida.toISOString() ?? null,
        visitada: Boolean(p && p.saida < agora),
        noLocal: Boolean(p && p.chegada <= agora && p.saida >= agora),
        total: daCidade.length,
        resolvidas: daCidade.filter((t) => t.situacao === 'iniciada').length,
        pendentes: daCidade.filter((t) => t.situacao === 'pendente').length,
      });
    }
  }

  const visitadas = paradas.filter((p) => p.visitada || p.noLocal);
  const pendencias = tarefas
    .filter((t) => t.situacao === 'pendente' && paradas.some((p) => p.visitada && p.data === t.prazo && chaveCidade(t.cidade) === p.chave))
    .map((t) => ({ id: t.id, cidade: t.cidade, cliente: t.cliente, tipo: t.tipo, data: t.prazo, descricao: t.descricao }));

  const despesas = await listarDespesas(atendenteId, semana.inicio, semana.fim);
  const acoes = await listarAcoes(atendenteId, semana.inicio, semana.fim);
  const porCategoria = Object.fromEntries(Object.keys(CATEGORIAS_DESPESA).map((c) => [c, 0])) as Record<CategoriaDespesa, number>;
  for (const d of despesas) porCategoria[d.categoria] += d.valor;
  const litros = despesas.reduce((s, d) => s + (d.litros ?? 0), 0);
  const kmSemana = dias.reduce((s, d) => s + kmDia(d), 0);

  return {
    atendente,
    semana,
    base: CIDADES[BASE],
    posicao: posicaoAtual,
    rotaHoje: reduzir(trajetos[hoje] ?? []),
    rotaSemana: dias.filter((d) => d !== hoje).map((d) => reduzir(trajetos[d], 120)),
    paradas,
    indicadores: {
      pastasResolvidas: visitadas.reduce((s, p) => s + p.resolvidas, 0),
      pastasNasCidadesVisitadas: visitadas.reduce((s, p) => s + p.total, 0),
      pastasSemana: tarefas.length,
      kmSemana,
      kmHoje: kmDia(hoje),
      pendenciasDeixadas: pendencias.length,
      acoesNovas: acoes.length,
      gastosSemana: Math.round(despesas.reduce((s, d) => s + d.valor, 0) * 100) / 100,
      gastosPorCategoria: porCategoria,
      litros,
      kmPorLitro: litros > 0 ? Math.round((kmSemana / litros) * 10) / 10 : null,
      custoPorKm: kmSemana > 0 ? Math.round((porCategoria.combustivel / kmSemana) * 100) / 100 : null,
    },
    porDia: semana.diasUteis.map((data) => {
      const doDia = paradas.filter((p) => p.data === data);
      return {
        data,
        cidades: doDia.map((p) => p.cidade),
        km: data <= hoje ? kmDia(data) : null,
        resolvidas: doDia.reduce((s, p) => s + p.resolvidas, 0),
        total: doDia.reduce((s, p) => s + p.total, 0),
        pendencias: pendencias.filter((p) => p.data === data).length,
        gastos: Math.round(despesas.filter((d) => d.data === data).reduce((s, d) => s + d.valor, 0) * 100) / 100,
        acoesNovas: acoes.filter((a) => a.data === data).length,
      };
    }),
    pendencias,
    despesas,
    acoes,
    fonteRastreador: posicaoAtual.fonte,
  };
}

export async function registrarDespesa(dados: Omit<Despesa, 'id' | 'exemplo' | 'criadaEm' | 'data'> & { data?: string }): Promise<Despesa> {
  const despesa: Despesa = { ...dados, data: dados.data ?? hojeSp(), id: randomUUID(), exemplo: false, criadaEm: new Date().toISOString() };
  await salvarDespesa(despesa);
  return despesa;
}

export function excluirDespesa(id: string, atendenteId: string) {
  return removerDespesa(id, atendenteId);
}

export async function registrarAcao(dados: Omit<AcaoNova, 'id' | 'exemplo' | 'criadaEm' | 'data'> & { data?: string }): Promise<AcaoNova> {
  const acao: AcaoNova = { ...dados, data: dados.data ?? hojeSp(), id: randomUUID(), exemplo: false, criadaEm: new Date().toISOString() };
  await salvarAcao(acao);
  return acao;
}

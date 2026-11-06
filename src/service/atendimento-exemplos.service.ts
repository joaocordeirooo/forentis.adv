import { randomUUID } from 'node:crypto';
import { CIDADES, PLANO_SEMANA_EXEMPLO } from '@/config/rota.config';
import type { TarefaAtendimento } from '@/models/atendimento.model';
import type { AcaoNova, Despesa } from '@/models/rota.model';
import { semanaAtual } from '@/utils/semana.util';
import { agendaDoDia } from './rastreador-simulado.service';

// Semana de EXEMPLO do atendente fictício, com tipos reais do Atendimento Externo e clientes fictícios.
// Os dias que já passaram vêm resolvidos (com algumas pendências deixadas de propósito).

type Modelo = Pick<TarefaAtendimento, 'setor' | 'tipo' | 'descricao' | 'cliente' | 'processo'>;

const POR_CIDADE: Record<string, Modelo[]> = {
  videira: [
    { setor: 'Setor Invalidez', tipo: 'Coletar Assinatura (A.J) - Invalidez', descricao: 'Assinar procuração, contrato de honorários e termo de renúncia ao excedente do JEF.', cliente: 'Marlene Aparecida Schmitt', processo: null },
    { setor: 'Arquivo Central', tipo: 'Devolução CTPS - Arq. Central', descricao: 'Devolver CTPS original e carnês de contribuição; colher assinatura no recibo.', cliente: 'Cleusa Maria Pereira', processo: null },
  ],
  cacador: [
    { setor: 'Revisão', tipo: 'Localizar Cliente - Revisão', descricao: 'Confirmar com o cliente se trabalhou na roça antes de 1991 e recolher documentos rurais.', cliente: 'Ivone Terezinha Becker', processo: null },
    { setor: 'Judicial', tipo: 'Prazo Judicial - Judicial', descricao: 'Entregar intimação da perícia e orientar sobre data, local e documentos.', cliente: 'Sirlei Fátima Zanella', processo: '5002210-44.2025.4.04.7211' },
  ],
  curitibanos: [
    { setor: 'Arquivo Administrativo', tipo: 'Coletar Assinatura (A.J) - Arq. Adm', descricao: 'Assinatura do requerimento administrativo e da autodeclaração do segurado especial.', cliente: 'Osmar Luiz Gaio', processo: null },
    { setor: 'Setor Invalidez', tipo: 'Retorno Ação Nova - Invalidez', descricao: 'Recolher atestados e exames recentes e receituário de uso contínuo.', cliente: 'Dirceu Antônio Pires', processo: null },
  ],
  lages: [
    { setor: 'Financeiro', tipo: 'Entrega de Concessão - Financeiro', descricao: 'Entregar carta de concessão, explicar o primeiro pagamento e colher assinatura no recibo.', cliente: 'Pedro Henrique Wolff', processo: '5001155-60.2023.4.04.7222' },
    { setor: 'Revisão', tipo: 'Cliente vai no atendimento - Revisão', descricao: 'Receber cópia da CTPS (identificação e contratos) e PPP da empresa atual.', cliente: 'Valdir Antunes de Oliveira', processo: '5000893-67.2024.4.04.7128' },
  ],
  camposnovos: [
    { setor: 'Setor de Cálculos - Ações Novas', tipo: 'Retorno Ação Nova - Setor de Cálculo', descricao: 'Recolher holerites de 2019 a 2021 e extrato do FGTS.', cliente: 'Gilberto da Rosa', processo: null },
  ],
  joacaba: [
    { setor: 'Arquivo Central', tipo: 'Devolução CTPS - Arq. Central', descricao: 'Devolver 2 CTPS originais e colher assinatura no recibo de devolução.', cliente: 'Luiz Fernando Krüger', processo: null },
    { setor: 'Arquivo Administrativo', tipo: 'Diversos - Arq. Adm', descricao: 'Buscar comprovante de residência atualizado e documento de identidade com CPF.', cliente: 'Neusa Rodrigues da Silva', processo: null },
  ],
  vacaria: [
    { setor: 'Setor Invalidez', tipo: 'Coletar Assinatura (A.J) - Invalidez', descricao: 'Coletar assinatura na procuração e na declaração de hipossuficiência.', cliente: 'Antônio Carlos Ferreira', processo: null },
    { setor: 'Setor Invalidez', tipo: 'Localizar Cliente - Invalidez', descricao: 'Cliente sem retorno no WhatsApp: ir ao endereço e pedir contato atualizado.', cliente: 'Rosimeri de Fátima Lopes', processo: null },
    { setor: 'Revisão', tipo: 'Cliente vai no atendimento - Revisão', descricao: 'Receber PPP e LTCAT da empresa de transporte onde trabalhou.', cliente: 'Elton Bortolini', processo: null },
    { setor: 'Arquivo Central', tipo: 'Devolução CTPS - Arq. Central', descricao: 'Devolver CTPS original; colher assinatura no recibo.', cliente: 'Jurema Castilhos', processo: null },
    { setor: 'Financeiro', tipo: 'Entrega de Concessão - Financeiro', descricao: 'Entregar carta de concessão da aposentadoria e explicar o pagamento dos atrasados.', cliente: 'Nelson Tedesco', processo: '5003012-18.2024.4.04.7107' },
  ],
  lebonregis: [
    { setor: 'Setor Invalidez', tipo: 'Coletar Assinatura (A.J) - Invalidez', descricao: 'Assinar procuração e declaração de hipossuficiência.', cliente: 'José Eduardo Nunes', processo: null },
    { setor: 'Revisão', tipo: 'Localizar Cliente - Revisão', descricao: 'Pedir cópia do processo administrativo que o cliente guardou em casa.', cliente: 'Adelino Schuster', processo: null },
  ],
  montecarlo: [
    { setor: 'Arquivo Administrativo', tipo: 'Diversos - Arq. Adm', descricao: 'Recolher certidão de casamento e comprovante de residência.', cliente: 'Terezinha Kunz', processo: null },
    { setor: 'Setor Invalidez', tipo: 'Retorno Ação Nova - Invalidez', descricao: 'Recolher laudo do ortopedista e exames de imagem.', cliente: 'Marcos Vinícius Rauber', processo: null },
  ],
};

// Pastas que ficaram pendentes de propósito (cidade:índice), para o painel mostrar pendências deixadas.
const PENDENCIAS_EXEMPLO = new Set(['lages:1', 'vacaria:1']);

function hojeSp() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function pastasPorCidadeExemplo(): Record<string, number> {
  return Object.fromEntries(Object.entries(POR_CIDADE).map(([c, l]) => [c, l.length]));
}

export function gerarExemplos(atendenteId: string): TarefaAtendimento[] {
  const { diasUteis } = semanaAtual();
  const agora = new Date();
  const hoje = hojeSp();
  const tarefas: TarefaAtendimento[] = [];

  diasUteis.forEach((data, dia) => {
    const agenda = agendaDoDia(data, pastasPorCidadeExemplo());
    for (const chave of PLANO_SEMANA_EXEMPLO[dia]) {
      const parada = agenda.paradas.find((p) => p.chave === chave);
      // Resolvidas: dias anteriores e, hoje, cidades que o carro já deixou na hora em que os exemplos foram gerados.
      const jaPassou = data < hoje || (data === hoje && parada !== undefined && parada.saida < agora);
      POR_CIDADE[chave].forEach((m, i) => {
        const resolvida = jaPassou && !PENDENCIAS_EXEMPLO.has(`${chave}:${i}`);
        tarefas.push({
          ...m,
          id: `ex-${atendenteId}-${chave}-${i + 1}`,
          tarefaId: null,
          exemplo: true,
          atendenteId,
          titulo: m.tipo,
          cidade: CIDADES[chave].nome,
          prazo: data,
          situacao: resolvida ? 'iniciada' : 'pendente',
          iniciadaEm: resolvida && parada ? new Date(parada.chegada.getTime() + (i + 1) * 20 * 60_000).toISOString() : null,
          iniciadaPor: resolvida ? 'Rafael Moreira (fictício)' : null,
        });
      });
    }
  });
  return tarefas;
}

// Gastos e ações novas de exemplo dos dias que já passaram.
export function gerarMovimentosExemplo(atendenteId: string): { despesas: Despesa[]; acoes: AcaoNova[] } {
  const { diasUteis } = semanaAtual();
  const hoje = hojeSp();
  const horaAgora = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  const criadaEm = new Date().toISOString();
  const despesas: Despesa[] = [];
  const acoes: AcaoNova[] = [];
  const despesa = (data: string, categoria: Despesa['categoria'], valor: number, cidade: string, descricao: string, litros: number | null = null) =>
    despesas.push({ id: randomUUID(), atendenteId, data, categoria, valor, descricao, cidade, litros, exemplo: true, criadaEm });

  const almocos = [38.9, 45.5, 41.0, 52.0, 36.5];
  diasUteis.forEach((data, dia) => {
    const passou = data < hoje || (data === hoje && horaAgora >= 13);
    if (!passou) return;
    const cidade = CIDADES[PLANO_SEMANA_EXEMPLO[dia][PLANO_SEMANA_EXEMPLO[dia].length - 1]].nome;
    despesa(data, 'alimentacao', almocos[dia], cidade, 'Almoço');
  });
  if (diasUteis[1] < hoje) despesa(diasUteis[1], 'combustivel', 263.5, 'Lages', 'Abastecimento — gasolina', 42.5);
  if (diasUteis[3] < hoje) {
    despesa(diasUteis[3], 'combustivel', 302.4, 'Vacaria', 'Abastecimento — gasolina', 48);
    despesa(diasUteis[3], 'estacionamento', 8, 'Vacaria', 'Estacionamento no centro');
    despesa(diasUteis[3], 'alimentacao', 9.5, 'Vacaria', 'Café da tarde');
  }
  if (diasUteis[1] < hoje) {
    acoes.push({ id: randomUUID(), atendenteId, data: diasUteis[1], cliente: 'Sebastião Ribeiro', cidade: 'Lages', tipo: 'Aposentadoria por incapacidade', observacao: 'Indicação do cliente Pedro Henrique Wolff.', exemplo: true, criadaEm });
  }
  if (diasUteis[3] < hoje) {
    acoes.push({ id: randomUUID(), atendenteId, data: diasUteis[3], cliente: 'Lurdes Fontana', cidade: 'Vacaria', tipo: 'Aposentadoria especial', observacao: 'Motorista de caminhão por 22 anos; trazer PPPs.', exemplo: true, criadaEm });
    acoes.push({ id: randomUUID(), atendenteId, data: diasUteis[3], cliente: 'Arlindo Pegoraro', cidade: 'Vacaria', tipo: 'BPC/LOAS', observacao: null, exemplo: true, criadaEm });
  }
  return { despesas, acoes };
}

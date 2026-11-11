// Agente cadastrado à mão na estação Agentes: o que é, onde roda e o que está fazendo.

export const STATUS_AGENTE = ['producao', 'teste', 'desenvolvimento', 'pausado'] as const;
export type StatusAgente = (typeof STATUS_AGENTE)[number];

export const PLATAFORMAS_AGENTE = ['skill_claude', 'tarefa_agendada_claude', 'forentis', 'n8n', 'outro'] as const;
export type PlataformaAgente = (typeof PLATAFORMAS_AGENTE)[number];

// Registro de "o que o agente está fazendo", com data — vira o histórico do agente.
export interface AtualizacaoAgente {
  id: string;
  texto: string;
  autor: string | null;
  criadaEm: string;
}

export interface Agente {
  id: string;
  nome: string;
  descricao: string; // o que o agente faz
  status: StatusAgente;
  plataforma: PlataformaAgente;
  setor: string | null; // setor do escritório atendido (texto livre)
  gatilho: string | null; // quando roda: "seg–sex 06:30", "quando chega publicação", "manual"...
  responsavel: string | null; // quem cuida do agente
  ferramentas: string[]; // integrações que usa: Lawyertool, ChatGuru, OpenAI...
  link: string | null; // onde abrir (skill, tarefa agendada, workflow)
  fazendoAgora: string | null; // última atualização (cópia da mais recente, para a lista)
  atualizacoes: AtualizacaoAgente[]; // mais recente primeiro
  criadoEm: string;
  atualizadoEm: string;
}

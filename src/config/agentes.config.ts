import type { PlataformaAgente, StatusAgente } from '@/models/agente.model';

// Rótulos e cores usados na estação Agentes.

export const ROTULO_STATUS_AGENTE: Record<StatusAgente, string> = {
  producao: 'Em produção',
  teste: 'Em teste',
  desenvolvimento: 'Em desenvolvimento',
  pausado: 'Pausado',
};

export const ROTULO_PLATAFORMA_AGENTE: Record<PlataformaAgente, string> = {
  skill_claude: 'Skill do Claude',
  tarefa_agendada_claude: 'Tarefa agendada do Claude',
  forentis: 'Forentis',
  n8n: 'n8n',
  outro: 'Outro',
};

export const MAX_ATUALIZACOES_AGENTE = 200; // histórico guardado por agente

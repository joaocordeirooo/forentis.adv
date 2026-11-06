export interface MensagemDex {
  papel: 'pessoa' | 'dex';
  texto: string;
  em: string;
  consultas?: string[]; // ferramentas que a DEX usou para responder
}

export interface ConversaDex {
  id: string;
  pessoa: string | null;
  criadaEm: string;
  atualizadaEm: string;
  mensagens: MensagemDex[];
}

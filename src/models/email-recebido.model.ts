import type { AnexoRegistrado, TipoRecebido } from './email.model';

// E-mail que chegou na caixa e não foi ligado a nenhuma conversa: alguém olha e vincula ou descarta.
export interface EmailNaoVinculado {
  id: string;
  messageId: string;
  uid: number | null;
  tipo: TipoRecebido;
  de: string;
  para: string[];
  assunto: string;
  texto: string;
  anexos: AnexoRegistrado[];
  motivoDevolucao: string | null;
  em: string; // data do e-mail
  recebidoEm: string; // quando o Forentis leu
  situacao: 'pendente' | 'vinculado' | 'descartado';
  conversaId: string | null;
  resolvidoPor: string | null;
  resolvidoEm: string | null;
}

export interface ResumoLeitura {
  origem: 'agenda' | 'manual';
  iniciadaEm: string;
  terminadaEm: string;
  lidas: number;
  respostas: number;
  automaticas: number;
  devolucoes: number;
  naoVinculadas: number;
  ignoradas: number; // repetidas ou enviadas pela própria caixa
  restantes: number; // ficaram para a próxima leitura (limite por vez)
  erros: string[];
}

// Até onde a caixa já foi lida (um registro só, id "caixa").
export interface EstadoLeituraCaixa {
  id: string;
  pasta: string;
  uidValidity: string | null; // se o servidor renumerar a caixa, recomeça pela data
  ultimoUid: number;
  ultimaLeitura: string | null;
  ultimoResumo: ResumoLeitura | null;
}

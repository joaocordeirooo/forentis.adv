// Formatos das respostas da API do Lawyertool.

export interface RespostaPaginada<T> {
  data: T[];
  total?: number;
  totalPages?: number;
}

export interface RespostaItem<T> {
  data: T;
}

export interface Processo {
  id: number;
  numeroProcesso?: string | null;
  emitente?: { id: number; nome: string } | null;
  tipoProcesso?: { descricao?: string } | null;
  situacaoPasta?: { descricao?: string } | null;
  obs?: string | null;
  alerta?: string | null;
}

export interface Movimentacao {
  id: number;
  descricao?: string | null;
  tipoMovimento?: { id: number; descricao?: string } | null;
  status?: { id: number; descricao?: string } | null;
  destaca?: boolean | null;
  [campo: string]: unknown;
}

export interface Arquivo {
  id: number;
  nomeArquivo?: string | null;
  processo?: { id: number } | null;
  emitente?: { id: number } | null;
  [campo: string]: unknown;
}

export interface Comentario {
  id: number;
  conteudo?: string | null;
  dataCad?: string | null;
  dataAlt?: string | null;
  tarefa?: { id: number } | null;
  usuario?: { nome?: string } | null;
}

export interface Emitente {
  id: number;
  nome?: string | null;
  telefoneWhats?: string | null;
  [campo: string]: unknown;
}

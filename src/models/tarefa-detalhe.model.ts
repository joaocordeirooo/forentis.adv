// A tarefa como aparece na tela de cadastro do Lawyertool, mais o que o Forentis preparou nela.

type Ref = { id: number; nome: string } | null;

export interface TarefaDetalhe {
  id: number;
  titulo: string | null;
  descricao: string; // texto (o HTML do editor convertido, com as quebras de linha)
  situacao: string | null;
  prioridade: string | null;
  destaca: boolean;
  atrasada: boolean;
  diasAtraso: number | null;
  subtarefa: boolean;
  tarefaPai: Ref;
  setor: Ref;
  fluxo: Ref;
  tipoTarefa: Ref;
  pessoa: Ref;
  processo: { id: number; numero: string | null } | null;
  usuarioResponsavel: Ref;
  usuarioSolicitante: Ref;
  responsaveis: string[];
  datas: {
    inicio: string | null;
    finalEsperada: string | null;
    finalReal: string | null;
    bloqueio: string | null;
    cadastro: string | null;
    alteracao: string | null;
  };
  criadoPor: string | null;
  alteradoPor: string | null;
  comentarios: { id: number; usuario: string | null; conteudo: string; em: string | null }[];
  historico: { id: number; usuario: string | null; acao: string | null; campo: string | null; de: string | null; para: string | null; descricao: string | null; em: string | null }[];
  solicitacoes: { id: string; tipo: string; status: string; titulo: string; criadaEm: string }[];
  avisos: string[]; // partes que não carregaram (comentários, histórico)
}

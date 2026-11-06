import type { Pendencia } from './analise.model';

// Contato encontrado para a empresa (tabela interna ou CNPJa). Nunca é "confirmado" automaticamente.
export interface ContatoEncontrado {
  tipo: 'email' | 'telefone';
  valor: string;
  origem: 'tabela_interna' | 'CNPJa';
  empresa_origem: string | null;
  cnpj_origem: string | null;
}

// Um grupo de pendências da mesma empresa (nó agruparEmpresas).
export interface GrupoEmpresa {
  empresa: string; // nome como veio da análise
  empresaChave: string;
  identificada: boolean;
  pendencias: Pendencia[];
}

// Candidato a leitura para localizar CTPS, procuração etc. (nó localizarDocumentacao).
export interface ArquivoParaAnalisar {
  id: number;
  nome: string | null;
  tipos_candidatos: string[];
  perguntas_analise: string[];
}

// Resultado consolidado da leitura dos PDFs (nó consolidaAnalises).
export interface AnalisesConsolidadas {
  arquivos_analisados: Record<string, unknown>[];
  arquivos_com_falha_na_analise: { arquivo_id: number | null; nome: string | null; erro: string }[];
  arquivos_pendentes: Record<string, unknown>[];
  documentos: Record<string, unknown>[];
  inconsistencias: Record<string, unknown>[];
  sugestoes_recorte: Record<string, unknown>[];
  pendencias_indicadas_pelas_analises: Record<string, unknown>[];
  resumos_por_arquivo: { arquivo_ids: unknown[]; resumo: string }[];
}

// Avaliação final das pendências da empresa (nó avaliarPendencias + prepararSaida).
export interface AvaliacaoEmpresa {
  decisao: 'preparar_solicitacao' | 'aguardar_confirmacao_cliente' | 'revisao_humana' | 'sem_pendencias' | string;
  pendencias_avaliadas: Record<string, unknown>[];
  confirmacoes_com_cliente: string[];
  documentos_para_preparar_solicitacao: {
    documento: string;
    destinatario_tipo?: string | null;
    destinatario_nome?: string | null;
    periodo: string | null;
    orientacoes?: string | null;
    fundamento_original?: string | null;
  }[];
  alertas: string[];
  resumo: string;
}

// Recorte aprovado pela validação (nó validarPlanoAnexos).
export interface RecortePlanejado {
  anexoId: string;
  arquivoId: number;
  arquivoNome: string | null;
  tipo: string;
  paginas: number[];
  nomeArquivo: string;
  finalidade: string;
}

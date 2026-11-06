// Resultado da análise da tarefa pela IA (nó "AI Agent" + "formatacao").

export type DecisaoAnalise =
  | 'preparar_pendencias'
  | 'consultar_arquivos'
  | 'conferencia_humana'
  | 'nenhuma_acao'
  | 'erro_analise'
  | 'erro_contexto';

export type SituacaoPendencia = 'solicitar' | 'solicitacao_identificada' | 'recebimento_identificado' | 'a_confirmar';

export interface Fonte {
  tipo: string;
  id: number | string | null;
  trecho: string;
}

export interface Pendencia {
  documento: string;
  destinatario_tipo: 'empresa' | 'cliente' | 'indefinido' | string;
  destinatario_nome: string | null;
  periodo: string | null;
  situacao: SituacaoPendencia | string;
  fontes: Fonte[];
}

export interface AnaliseTarefa {
  decisao: DecisaoAnalise;
  resumo: string;
  pendencias: Pendencia[];
  arquivos_para_ler: { id: number | null; motivo: string }[];
  duvidas: string[];
  texto_cliente: string;
  confianca_cliente: 'alta' | 'media' | 'baixa' | null;
  motivo_nao_tratada?: string;

  // Separação por destinatário (nó separarPendencias).
  pendencias_cliente: Pendencia[];
  pendencias_empresa: Pendencia[];
  pendencias_indefinidas: Pendencia[];
}

// Pedidos de cobrança de documentos que o Forentis manda para o workflow do n8n (ChatGuru).

export type StatusItemCobranca = 'aguardando_n8n' | 'enviada' | 'falha' | 'ignorada';

export interface ItemCobranca {
  tarefaId: number;
  processoId: number | null;
  emitenteId: number | null;
  clienteNome: string | null;
  status: StatusItemCobranca;
  detalhe: string | null; // motivo da falha / por que foi ignorada / o que o n8n respondeu
  atualizadoEm: string;
}

export interface PedidoCobranca {
  id: string;
  status: 'enviado_ao_n8n' | 'falha_ao_enviar';
  solicitadoPor: string | null;
  itens: ItemCobranca[];
  recusadas: { tarefaId: number; motivo: string }[]; // nem foram mandadas ao n8n
  erro: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

// O que o Forentis manda no POST para o webhook do n8n.
export interface PayloadCobrancaN8n {
  origem: 'forentis';
  pedidoId: string;
  solicitadoPor: string | null;
  modoTeste: boolean; // true = o n8n deve mandar só para o telefone de teste
  telefoneTeste: string | null;
  urlRetorno: string | null; // para onde o n8n avisa o resultado de cada tarefa
  tarefas: {
    tarefaId: number;
    titulo: string | null;
    tipoTarefa: string | null;
    processoId: number | null;
    numeroProcesso: string | null;
    emitenteId: number | null;
    clienteNome: string | null;
    telefoneWhats: string | null;
    usuarioResponsavel: string | null;
  }[];
}

// Status da cobrança de cada tarefa, para a tabela de tarefas.
export interface StatusCobrancaTarefa {
  tarefaId: number;
  status: StatusItemCobranca;
  detalhe: string | null;
  pedidoId: string;
  atualizadoEm: string;
}

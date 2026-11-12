// Único lugar do projeto que lê process.env.
// Cada sistema é lido só quando é usado: o projeto sobe mesmo sem SMTP configurado, por exemplo.

function obrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    throw new Error(`Variável ${nome} não definida no .env`);
  }
  return valor;
}

function opcional(nome: string, padrao = ''): string {
  return process.env[nome]?.trim() || padrao;
}

function numero(nome: string, padrao: number): number {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && process.env[nome]?.trim() ? valor : padrao;
}

function booleano(nome: string, padrao: boolean): boolean {
  const valor = process.env[nome]?.trim().toLowerCase();
  if (!valor) return padrao;
  return ['true', '1', 'sim', 'yes'].includes(valor);
}

export const config = {
  get lawyertool() {
    return {
      url: obrigatoria('LAWYERTOOL_URL').replace(/\/+$/, ''),
      token: obrigatoria('LAWYERTOOL_TOKEN'),
    };
  },

  get openai() {
    return {
      chave: obrigatoria('OPENAI_API_KEY'),
      url: opcional('OPENAI_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
      modeloAnalise: opcional('OPENAI_MODELO_ANALISE', 'gpt-4.1-mini'), // análise da tarefa e avaliação
      modeloCnpj: opcional('OPENAI_MODELO_CNPJ', 'gpt-4.1-mini'), // identificação do CNPJ no texto do PDF
      modeloPdf: opcional('OPENAI_MODELO_PDF', 'gpt-5.6-luna'), // leitura dos PDFs (precisa aceitar arquivo)
      modeloDex: opcional('OPENAI_MODELO_DEX', 'gpt-4.1-mini'), // chat da DEX
    };
  },

  get chatguru() {
    return {
      url: obrigatoria('CHATGURU_URL').replace(/\/+$/, ''),
      chave: obrigatoria('CHATGURU_KEY'),
      contaId: obrigatoria('CHATGURU_ACCOUNT_ID'),
      telefoneId: obrigatoria('CHATGURU_PHONE_ID'),
      dialogo: opcional('CHATGURU_DIALOG_ID', '66a78e0c15feb77151d1ce7c'), // "chamar o cliente com motivo"
      dialogoBloquearUra: opcional('CHATGURU_DIALOG_BLOQUEAR_URA', '65f86296767a1bfe9ca6db87'),
      campoDocumentos: opcional('CHATGURU_CAMPO_DOCUMENTOS', 'Documentos_Pendentes'),
      textoNovoChat: opcional('CHATGURU_TEXTO_NOVO_CHAT', 'Olá! Aqui é do escritório Darcísio Müller Advogados.'),
      esperaNovoChatSegundos: numero('CHATGURU_ESPERA_NOVO_CHAT', 60),
    };
  },

  get smtp() {
    return {
      host: obrigatoria('SMTP_HOST'),
      porta: numero('SMTP_PORT', 587),
      usuario: obrigatoria('SMTP_USER'),
      senha: obrigatoria('SMTP_PASS'),
      remetente: obrigatoria('SMTP_FROM'),
    };
  },

  get automacao() {
    return {
      modoTeste: booleano('MODO_TESTE', true), // true = WhatsApp e e-mail só vão para os destinos de teste
      telefoneTeste: opcional('TELEFONE_TESTE'),
      emailTeste: opcional('EMAIL_TESTE'),
      limiteTarefasTeste: numero('LIMITE_TAREFAS_TESTE', 3),
      diasSemRepetir: numero('DIAS_SEM_REPETIR', 7),
      maxCobrancasCliente: numero('MAX_COBRANCAS_CLIENTE', 3),
      maxCaracteresTemplate: numero('MAX_CARACTERES_TEMPLATE', 250),
      maxArquivosAnalise: numero('MAX_ARQUIVOS_ANALISE', 6), // PDFs lidos pela IA por empresa
      maxArquivosCnpj: numero('MAX_ARQUIVOS_CNPJ', 4), // PDFs lidos para achar o CNPJ
    };
  },

  get cnpja() {
    return { url: opcional('CNPJA_URL', 'https://open.cnpja.com').replace(/\/+$/, '') };
  },

  get agenda() {
    return {
      // Horários em que a análise roda sozinha (fuso de São Paulo). Vazio = só manual.
      horarios: opcional('AGENDA_HORARIOS', '06:30').split(',').map((h) => h.trim()).filter((h) => /^\d{2}:\d{2}$/.test(h)),
      // Dias da semana (0 = domingo ... 6 = sábado).
      dias: opcional('AGENDA_DIAS', '1,2,3,4,5').split(',').map(Number).filter((d) => d >= 0 && d <= 6),
    };
  },

  get atendimento() {
    return {
      // false = "Material coletado" só simula nas tarefas reais (não inicia nada no Lawyertool).
      executarLawyertool: booleano('ATENDIMENTO_EXECUTAR_LAWYERTOOL', false),
      // Usuários do Lawyertool cujas tarefas podem ser iniciadas/concluídas pelo Forentis (fase de teste). Ex.: "115,203".
      usuariosLiberados: opcional('ATENDIMENTO_USUARIOS_LIBERADOS', '115')
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isInteger(v) && v > 0),
      // De onde vem a posição do carro: "simulado" por enquanto; depois, o rastreador real.
      rastreador: opcional('RASTREADOR_PROVEDOR', 'simulado'),
    };
  },

  // Workflows do n8n (servidor interno). Sem a URL, a integração fica desligada e nada é disparado.
  get n8n() {
    return {
      cobrancaUrl: obrigatoria('N8N_COBRANCA_WEBHOOK_URL'), // webhook do workflow de cobrança de documentos (ChatGuru)
      token: opcional('N8N_TOKEN'), // enviado no cabeçalho x-forentis-token para o n8n conferir quem chamou
      retornoToken: opcional('N8N_RETORNO_TOKEN'), // o n8n manda este valor em x-n8n-token ao avisar o resultado
      timeoutSegundos: numero('N8N_TIMEOUT', 30),
      // Endereço do Forentis visto pelo servidor do n8n (ex.: http://192.168.0.20:3000). Vazio = n8n não avisa o resultado.
      urlForentis: opcional('FORENTIS_URL').replace(/\/+$/, ''),
    };
  },

  get api() {
    return { chave: opcional('API_KEY') }; // vazio = API aberta (só para testes locais)
  },

  get pastaDados() {
    return opcional('PASTA_DADOS', '.dados');
  },
};

// Diz se um bloco do config está completo, sem lançar erro.
export function estaConfigurado(ler: () => unknown): boolean {
  try {
    ler();
    return true;
  } catch {
    return false;
  }
}

Analise o PDF anexado nesta mensagem no contexto da tarefa abaixo.

ARQUIVO ANEXADO NESTA CHAMADA

ID: {{ID}}
Nome: {{NOME}}
Tipos candidatos, ainda não confirmados: {{TIPOS}}
Perguntas de análise: {{PERGUNTAS}}

Este é o único arquivo disponível nesta chamada.
Os demais arquivos citados no contexto não estão anexados.
Não declare que os leu.

TAREFA

Tarefa: {{TAREFA}}
Processo: {{PROCESSO}}
Empresa atual: {{EMPRESA}}
Nome normalizado da empresa: {{EMPRESA_NORMALIZADA}}
Períodos de interesse: {{PERIODOS}}

Use a empresa acima como alvo.
Dados de outras empresas no contexto não alteram esse alvo.
Se o alvo estiver ausente ou conflitante, registre a limitação.

O QUE PROCURAR

1. Identificação do titular, sem confundir dados cadastrais do CNIS com
   documento de identidade ou identificação da CTPS.

2. Páginas da própria CTPS:
   - identificação;
   - contrato com a empresa atual;
   - alterações e anotações pertinentes.

3. Procuração:
   - outorgante;
   - outorgados;
   - data;
   - assinatura visível, ausente ou ilegível.

4. Documentos relacionados às pendências e orientações registradas.
   Para PPP, confira períodos, funções e datas de alteração de função.
   Informe se existe evidência suficiente para verificar a correção
   solicitada ou se isso permanece inconclusivo.

5. CNPJ da empresa atual, somente quando explícito no arquivo,
   com página confirmada e trecho literal.

6. Eventuais atribuições indevidas de dados de outras empresas à atual.
   A simples presença de outras empresas no PDF não é inconsistência.

CONTROLE DE EVIDÊNCIAS

- CNIS não é CTPS. Um vínculo no CNIS deve ser classificado como
  vinculo_cnis e não como CTPS encontrada parcialmente.
- Não confunda sequência do vínculo com página física.
- Sugira recortes apenas com páginas confirmadas do próprio documento.
- Não afirme que um documento de uma página corresponde ao PDF inteiro.
- Menção a PPP ou procuração no índice é pista, não documento conferido.
- Ausência de CNPJ da empresa na procuração não é uma pendência por si só.
- Não conclua que um documento inexiste em todo o processo.

ARQUIVOS PENDENTES

Liste:
- os demais itens de arquivos_para_analisar, sem o arquivo desta chamada;
- outros arquivos com indicação concreta de relevância para documentos
  ainda não localizados.

Processos administrativos podem conter documentos agrupados, mesmo
quando o nome do arquivo não menciona CTPS, PPP ou procuração.
Indique o motivo da análise adicional.
Não declare que todos os arquivos listados são obrigatórios.

CONCLUSÃO

Defina analise_concluida como false, pois a consolidação será posterior.
Use leitura_completa para informar especificamente a cobertura deste PDF.
Se houver limitação, explique sem inventar páginas ou resultados.

Retorne somente o JSON definido no System Message.

CONTEXTO DA SOLICITAÇÃO

{{CONTEXTO}}

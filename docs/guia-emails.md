# Caixa de e-mail do Forentis — Parte 1 (envio, assinatura e registro)

Caixa única de solicitações na hospedagem `mail.damadvogados.com.br`, com envio pela porta 587 e IMAP na 993.
A pasta de enviados do servidor é `INBOX.Sent` (conferido em 13/11/2026).

## O que esta parte faz

- **Envio pelo Forentis** com a assinatura de quem conferiu: nome e cargo do funcionário, mais os dados do escritório e o logo.
- **Registro de cada envio** em `.dados/emails.json`. Cada pedido vira uma *conversa*, com código no assunto (`[DAM-4F7K2Q]`), destinatários, texto, anexos, quem enviou e quando.
- **Cópia na pasta Enviados** da caixa, para o e-mail aparecer no webmail/Outlook igual a um enviado à mão.
- **Lembrete na mesma conversa**: sai com "Re:" e os cabeçalhos de resposta, então a empresa recebe no mesmo fio. Trava: no máximo 3 envios por conversa, com `DIAS_SEM_REPETIR` dias entre eles.
- **Modo teste** (`MODO_TESTE=true`): tudo vai para o `EMAIL_TESTE`. O assunto leva `[TESTE]` e o corpo começa avisando para onde o e-mail iria.
- **Solicitação à empresa** (`envio-empresa.service.ts`) passa a enviar pela caixa: ganha assinatura, registro e código, e o código entra no comentário da tarefa.

## Instalação

1. Instale a biblioteca IMAP:
   ```
   npm i imapflow
   ```
2. Copie os arquivos do pacote para as mesmas pastas do projeto.
   - **Novos:** `config/email.config.ts`, `models/email.model.ts`, `models/assinatura-email.model.ts`, `repositories/email.repository.ts`, `repositories/assinatura-email.repository.ts`, `integrations/imap.integration.ts`, `service/caixa-email.service.ts`, `service/assinatura-email.service.ts`, `validators/email.validator.ts`, `validators/assinatura-email.validator.ts`, `controllers/email.controller.ts`, `controllers/assinatura-email.controller.ts` e as rotas em `app/api/emails/`.
   - **Substituídos:** `config/env.config.ts` (só ganhou o bloco `caixaEmail`), `integrations/email.integration.ts` (o `enviarEmail` antigo continua funcionando), `service/envio-empresa.service.ts` e `.env.example`.
3. Crie a conta `documentos@damadvogados.com.br` no painel da hospedagem (ou use outra e ajuste o `.env`).
4. Preencha no `.env` (modelo no `.env.example`):
   ```
   SMTP_HOST=mail.damadvogados.com.br
   SMTP_PORT=587
   SMTP_USER=documentos@damadvogados.com.br
   SMTP_PASS=********
   SMTP_FROM="DAM Advogados - Solicitações" <documentos@damadvogados.com.br>
   IMAP_PORT=993
   IMAP_PASTA_ENVIADOS=INBOX.Sent
   EMAIL_TESTE=seu-email@damadvogados.com.br
   ```
5. Coloque o logo em `public/email/logo-dam.png` (PNG, uns 220 px de largura). Sem o arquivo, a assinatura sai só com texto.
6. Complete endereço, telefone e site do escritório em `src/config/email.config.ts`. Linhas vazias não aparecem.

## Assinatura em imagem (uma por pessoa)

- Cada funcionário pode ter a própria imagem de assinatura, no padrão oficial da DAM (como a do João Cordeiro).
- As imagens ficam em `public/email/assinaturas/`. No cadastro da assinatura vai só o nome do arquivo, no campo `"imagem": "joao-cordeiro.jpg"`.
- Tamanho: 1200 x 300 px, em JPG ou PNG, até uns 150 KB. A arte original sai em 4000 x 1000 e pesa demais; reduza antes de colocar na pasta.
- No e-mail a imagem vai embutida (não como anexo solto) e aparece com 600 px de largura.
- Nome, cargo e telefone do cadastro continuam necessários. Eles viram o texto que aparece quando o leitor bloqueia imagens e a versão do e-mail em texto puro.
- Quem não tiver imagem sai com a assinatura em texto: nome, cargo, dados do escritório e o logo `public/email/logo-dam.png`, que foi recortado da assinatura oficial.

## Testar

Se houver `API_KEY` no `.env`, mande o cabeçalho `x-api-key` em todas as chamadas.

1. **Conexão** (não envia nada): `GET /api/emails/testar-conexao`. O retorno precisa ter `smtp.ok`, `imap.ok` e `pastaEnviados.existe` todos `true`.
2. **Assinatura do funcionário**: `POST /api/emails/assinaturas`
   ```json
   { "nome": "Matheus Farias", "cargo": "Setor de Revisão", "telefone": "(49) 0000-0000", "imagem": "matheus-farias.jpg" }
   ```
   Para conferir no navegador, abra `GET /api/emails/assinaturas/{id}/previa`, ou `/api/emails/assinaturas/padrao/previa` para quem não tem cadastro. Com `API_KEY` definida o navegador não manda o cabeçalho; teste a prévia sem a chave.
3. **Envio avulso** (modo teste ligado): `POST /api/emails`
   ```json
   {
     "para": ["rh@empresa.com.br"],
     "assunto": "Solicitação de PPP",
     "texto": "Prezados,\n\nSolicitamos o PPP de ...",
     "funcionario": "Matheus Farias",
     "vinculo": { "tipo": "avulso", "tarefaId": 12345 }
   }
   ```
   Responde 201 quando o e-mail saiu e 502 quando não saiu (a conversa fica registrada com o motivo). Com `tarefaId`, também comenta na tarefa do Lawyertool.
4. **Lembrete**: `POST /api/emails` com `{ "conversaId": "...", "texto": "Reiteramos o pedido...", "funcionario": "Matheus Farias" }`.
5. **Consulta**: `GET /api/emails?status=enviado&busca=DAM-` e `GET /api/emails/{id}`.

## Regras

- A assinatura é escolhida pelo nome do funcionário que conferiu, sem diferença de acento ou maiúscula. Sem cadastro, sai o nome dele com os dados do escritório.
- Uma solicitação com e-mail já enviado não envia de novo (409). A cobrança vai como lembrete na conversa.
- Se o envio falhar, a conversa fica com `status: "falhou"` e o próximo envio da mesma solicitação reaproveita a conversa.
- Se a cópia nos Enviados falhar, o e-mail já saiu e o envio não é desfeito. A mensagem fica com `copiadaEnviados: false`.
- Anexos somados até `EMAIL_MAX_ANEXOS_MB` (padrão 15 MB).

# Parte 2 — Caixa de entrada: respostas e monitoramento

A caixa de entrada é a pasta Entrada da conta `documentos@` no servidor da hospedagem. O Forentis lê essa pasta, e o webmail/Outlook continua funcionando normalmente.

## Como funciona

- **Leitura automática:** a cada `EMAIL_LEITURA_MINUTOS` (padrão 5), enquanto o Forentis estiver ligado. A primeira leitura acontece 20 segundos depois de subir. Para ler na hora, use `POST /api/emails/ler-caixa`.
- **Nada muda no servidor:** o Forentis não apaga, não move e não marca nada como lido. Ele guarda só até onde já leu, em `.dados/email-leitura.json`. A primeira leitura olha os e-mails desde a conversa mais antiga, ou dos últimos 7 dias, e nunca mais de 60 dias para trás.
- **Ligação com a conversa:**
  1. Cabeçalhos de resposta (In-Reply-To/References), que todo programa de e-mail manda ao responder.
  2. Código `[DAM-XXXXXX]` no assunto.
  3. Para devoluções, o Message-ID ou o código dentro da mensagem devolvida.
- **Tipos:**
  - **Resposta:** a conversa vira `respondido`. Só o texto novo é guardado, sem o histórico citado.
  - **Resposta automática** ("ausente", "férias"): fica no histórico mas não conta como resposta, e a conversa continua aguardando.
  - **Devolução** (endereço inexistente, caixa cheia): a conversa vira `devolvido`, o envio fica marcado como `devolvida` e o motivo do servidor é guardado (ex.: `550 5.1.1 User unknown`).
- **Anexos recebidos:** ficam em `.dados/emails-anexos/<conversa>/`. Imagens embutidas no corpo, como o logo da assinatura da empresa, são ignoradas. Anexo acima de 25 MB fica registrado mas não é guardado.
- **Lawyertool:** quando chega resposta ou devolução de uma conversa ligada a uma tarefa, o Forentis comenta na tarefa. Resposta automática não gera comentário. Para desligar: `EMAIL_COMENTAR_RESPOSTAS=false`. Os documentos não são anexados sozinhos; o funcionário confere e junta na tarefa.
- **Sem vínculo:** e-mail que não pertence a nenhuma conversa vai para "não vinculados", e alguém vincula ou descarta.
- **E-mails ignorados:** os enviados pela própria caixa e os já registrados (pelo Message-ID).

## Variáveis novas no .env

```
EMAIL_LEITURA_MINUTOS=5        # 0 = só manual
EMAIL_DIAS_SEM_RESPOSTA=7      # depois disso a conversa aparece como "sem resposta"
EMAIL_COMENTAR_RESPOSTAS=true  # comenta na tarefa do Lawyertool
```

## Rotas

| Rota | Para quê |
|---|---|
| `POST /api/emails/ler-caixa` | Lê a caixa agora e devolve o resumo (lidas, respostas, devoluções, automáticas, sem vínculo, erros) |
| `GET /api/emails/resumo` | Monitoramento: totais por situação, conversas com resposta nova, sem resposta há N dias, devolvidos, não vinculados pendentes, última leitura |
| `GET /api/emails?semResposta=true` | Conversas enviadas há N dias ou mais sem resposta |
| `GET /api/emails?respostaNova=true` | Conversas com resposta ou devolução ainda não conferida |
| `POST /api/emails/{id}/conferir` | Zera as respostas novas da conversa |
| `GET /api/emails/{id}/anexos/{mensagemId}/{indice}` | Abre ou baixa um anexo recebido |
| `GET /api/emails/nao-vinculados?situacao=pendente` | E-mails sem vínculo (`pendente`, `vinculado`, `descartado` ou `todos`) |
| `POST /api/emails/nao-vinculados/{id}/vincular` | `{ "conversaId": "...", "funcionario": "..." }`: liga o e-mail à conversa |
| `POST /api/emails/nao-vinculados/{id}/descartar` | `{ "funcionario": "..." }` |
| `GET /api/emails/nao-vinculados/{id}/anexos/{indice}` | Anexo de um e-mail sem vínculo |

## Testar (modo teste)

1. Envie um e-mail pelo Forentis: ele chega no `EMAIL_TESTE`.
2. Responda esse e-mail do seu e-mail, com um PDF anexo.
3. Chame `POST /api/emails/ler-caixa`, ou espere a leitura automática.
4. Em `GET /api/emails/{id}` a conversa deve estar `respondido`, com a resposta e o anexo.

# Parte 3 — Tela "E-mails"

No menu, estação **E-mails → Caixa de solicitações** (`/emails`).

- **Indicadores** (clicáveis, filtram a lista): com resposta nova, aguardando resposta, sem resposta há N+ dias, devolvidos, sem vínculo.
- **Leitura da caixa:**
  - mostra quando a caixa foi lida e o que achou;
  - avisa se ficou e-mail para a próxima leitura ou se deu erro;
  - o botão **Ler caixa agora** lê na hora.
- **Conversas:** filtro por situação e busca por código, assunto, empresa, e-mail ou tarefa. As que têm novidade aparecem primeiro, com um selo verde.
- **Detalhe da conversa** (painel lateral):
  - dados do pedido e link para a tarefa do Lawyertool;
  - histórico de envios, respostas, respostas automáticas e devoluções, com o motivo da devolução;
  - anexos recebidos, que abrem com um clique;
  - botão **Conferido**, que tira a conversa de "com resposta nova";
  - **Mandar lembrete**: sai no mesmo fio do e-mail anterior, com texto pronto;
  - **Reenviar para outro endereço**, quando o e-mail foi devolvido: corrija o endereço e reenvie;
  - **Tentar enviar de novo**, quando o envio não saiu.
- **Novo e-mail:** e-mail avulso, com destinatários, cópia, assunto, texto, tarefa (opcional; ela recebe os comentários), empresa e anexos até 15 MB.
- **Sem vínculo:** e-mails que chegaram sem pedido. **Vincular a uma conversa** (com busca) ou **Descartar**.
- **Assinaturas e conexão:**
  - teste do servidor (envio, leitura e pasta Enviados);
  - cadastro das assinaturas com prévia de como sai no e-mail;
  - envio da imagem pronta de cada pessoa (PNG/JPG até 600 KB, ideal 1200 x 300) e volta para a assinatura em texto.
- O nome de quem usa a tela é o mesmo das outras telas (`forentis.funcionario` no navegador) e escolhe a assinatura.

Observação: as rotas da API não usam `export const runtime`. O `cacheComponents` do `next.config` não aceita essa opção, e o Node já é o padrão.

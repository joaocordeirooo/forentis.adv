# Integração Forentis → n8n: cobrança de documentos (Setor Invalidez)

Situação: **pronta e desligada**. O workflow de cobrança roda no n8n do servidor interno, sem rota acessível
pelo Forentis. Enquanto `N8N_COBRANCA_WEBHOOK_URL` estiver vazio, o botão "Cobrar pelo n8n" aparece desabilitado
e nada é disparado.

## Como funciona

1. Em **Tarefas → Filtrar tarefas**, filtre Setor Invalidez → fluxo Cobrar Documentos (67).
2. Marque as tarefas e clique em **Cobrar pelo n8n** → **Confirmar**.
3. O Forentis confere no Lawyertool que cada tarefa é do setor 7 / fluxo 67 e está pendente, iniciada ou bloqueada
   (as outras são recusadas com o motivo) e faz um POST no webhook do n8n.
4. O n8n faz a cobrança pelo ChatGuru como já faz hoje.
5. No fim, o n8n avisa o Forentis o resultado de cada tarefa (opcional, mas recomendado).
6. A coluna **Automação** da tabela mostra: Enviada ao n8n / Cobrança enviada / Falha na cobrança / Ignorada pelo n8n.

Os pedidos ficam guardados em `.dados/cobrancas-n8n.json`.

## Para ligar (no Forentis, arquivo .env)

```
N8N_COBRANCA_WEBHOOK_URL=https://<rota-externa-do-n8n>/webhook/forentis-cobranca
N8N_TOKEN=<um segredo qualquer>          # o Forentis manda em x-forentis-token
N8N_RETORNO_TOKEN=<outro segredo>        # o n8n manda em x-n8n-token ao avisar o resultado
FORENTIS_URL=http://<endereço do Forentis visto pelo servidor do n8n>:3000
```

Reinicie o `npm run dev` depois de mudar o `.env`.

## O que mudar no workflow do n8n

### 1. Nó Webhook (início novo, ao lado do gatilho manual)

- HTTP Method: **POST**
- Path: `forentis-cobranca`
- Authentication: **Header Auth** → Name `x-forentis-token`, Value = o mesmo `N8N_TOKEN`
- Respond: **Immediately** (o Forentis não fica esperando os envios terminarem)

Corpo que chega:

```json
{
  "origem": "forentis",
  "pedidoId": "b3c1…",
  "solicitadoPor": "Matheus",
  "modoTeste": true,
  "telefoneTeste": "554999832158",
  "urlRetorno": "http://192.168.0.20:3000/api/integracoes/n8n/cobranca/retorno",
  "tarefas": [
    {
      "tarefaId": 6093,
      "titulo": "…",
      "tipoTarefa": "…",
      "processoId": 43103,
      "numeroProcesso": null,
      "emitenteId": 33377,
      "clienteNome": "Lidemar Batista da Silva Cunha",
      "telefoneWhats": "54992658671",
      "usuarioResponsavel": "…"
    }
  ]
}
```

### 2. Usar as tarefas recebidas no lugar da busca no Lawyertool

- Nó **Split Out** no campo `body.tarefas` → um item por tarefa.
- Ligue a saída no ponto do workflow que hoje recebe cada tarefa vinda do Lawyertool
  (ou, se preferir manter a busca, filtre o resultado pelos `tarefaId` recebidos).
- Respeite `modoTeste` / `telefoneTeste`: com `modoTeste = true`, mandar só para o telefone de teste.

### 3. Avisar o resultado ao Forentis (fim do workflow)

Nó **HTTP Request**:

- Method: **POST**
- URL: `{{ $('Webhook').item.json.body.urlRetorno }}`
- Header: `x-n8n-token` = o mesmo `N8N_RETORNO_TOKEN`
- Body (JSON):

```json
{
  "pedidoId": "{{ $('Webhook').item.json.body.pedidoId }}",
  "resultados": [
    { "tarefaId": 6093, "status": "enviada", "detalhe": "Mensagem enviada pelo diálogo 66a78e0c…" },
    { "tarefaId": 6092, "status": "falha", "detalhe": "Contato sem WhatsApp" },
    { "tarefaId": 6091, "status": "ignorada", "detalhe": "Já cobrado nos últimos 7 dias" }
  ]
}
```

`status`: `enviada`, `falha` ou `ignorada`. Pode mandar um aviso por tarefa ou todos juntos no fim.

## Rotas do Forentis

| Rota | Quem chama | Para quê |
|---|---|---|
| `GET /api/integracoes/n8n/cobranca?tarefas=1,2` | painel | se está ligada + status de cada tarefa |
| `POST /api/integracoes/n8n/cobranca` | painel | `{ tarefaIds, solicitadoPor }` → dispara o n8n |
| `POST /api/integracoes/n8n/cobranca/retorno` | n8n | resultado de cada tarefa (exige `x-n8n-token`) |

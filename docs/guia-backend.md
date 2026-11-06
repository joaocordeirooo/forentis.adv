# Backend de solicitação de documentos — guia rápido

## Instalação
1. `npm install zod unpdf pdf-lib nodemailer` e `npm install -D @types/nodemailer`
2. Copie `.env.example` para `.env` e preencha.
3. `npm run dev` e abra `http://localhost:3000/api/health` (mostra o que está configurado).

## Como funciona
1. **Análise** (`POST /api/analises`): lê as tarefas pendentes do fluxo 56 / tipo 30 /
   "Dar andamento Revisão - Analise RMI", analisa cada uma com a IA (mesmo prompt do n8n) e
   prepara as solicitações. **Nada é enviado nesta etapa.**
   - Cliente: texto do {Documentos_Pendentes} pronto.
   - Empresa: contato (tabela interna ou CNPJ → CNPJa), leitura dos PDFs, pedido redigido e
     recortes da CTPS/procuração em PDF.
2. **Conferência**: o funcionário lista as solicitações, ajusta texto/destinatário/anexos.
3. **Concluir**: cliente → WhatsApp pelo ChatGuru; empresa → e-mail com os recortes.
   Em seguida o sistema comenta na tarefa do Lawyertool (o comentário alimenta as travas).

## Rotas
Todas, menos `/api/health`, exigem o cabeçalho `x-api-key` (valor do `API_KEY`).

| Método | Rota | Para quê |
|---|---|---|
| GET | `/api/health` | Situação da configuração |
| GET | `/api/tarefas` | Tarefas pendentes no Lawyertool |
| POST | `/api/analises` | Inicia a análise. Corpo opcional: `{"tarefaId": 123}` |
| GET | `/api/analises` | Últimas execuções |
| GET | `/api/analises/:id` | Execução + relatório (tarefas não tratadas e motivo de cada uma) |
| GET | `/api/solicitacoes?status=aguardando_conferencia&tipo=cliente` | Fila de conferência |
| GET | `/api/solicitacoes/:id` | Detalhe |
| PATCH | `/api/solicitacoes/:id` | Editar: `{"por":"Ana","texto":"...","assunto":"...","destinatario":{"email":"..."},"anexos":[{"id":"...","incluir":false}]}` |
| POST | `/api/solicitacoes/:id/concluir` | Enviar: `{"funcionario":"Ana"}` (+ `"ignorarBloqueios": true` se houver bloqueios) |
| POST | `/api/solicitacoes/:id/descartar` | `{"funcionario":"Ana","motivo":"..."}` |
| GET | `/api/solicitacoes/:id/anexos/:anexoId` | Abre o PDF recortado |
| GET/POST | `/api/contatos-empresas` | Contatos internos das empresas |
| POST | `/api/contatos-empresas/importar` | `{"csv":"empresa;email;telefone;cnpj\n..."}` ou `{"contatos":[...]}` |

## Status das solicitações
- `aguardando_conferencia`: pronta para o funcionário conferir e concluir.
- `bloqueada`: tem bloqueios (confiança baixa, limite de 3 envios, revisão humana, documentos não analisados...).
- `concluida` / `falha_envio` (pode tentar de novo) / `descartada` / `substituida` (uma análise nova trouxe outras pendências).

## Exemplos (PowerShell)
```
curl.exe -X POST http://localhost:3000/api/analises -H "x-api-key: SUA_CHAVE" -H "content-type: application/json" -d "{}"
curl.exe "http://localhost:3000/api/solicitacoes?status=aguardando_conferencia" -H "x-api-key: SUA_CHAVE"
```

## Agendamento
Enquanto não há agendador interno, use o Agendador de Tarefas do Windows para rodar,
no horário desejado, o primeiro comando de exemplo acima.

## Painel (frontend)
Instale também: `npm install motion lucide-react clsx tailwind-merge`.
Abra `http://localhost:3000`:
- **Visão geral**: o fluxo animado (Lawyertool → IA → cliente/empresa → conferência → enviadas), a análise ao vivo e a fila de conferência.
- **Solicitações**: filtros, busca e o painel de conferência (prévia do WhatsApp, e-mail editável, anexos, pendências com as fontes, histórico, concluir/descartar).
- **Execuções**: cada rodada com as tarefas não tratadas e o motivo de cada uma.
- **Tarefas**: as tarefas pendentes do Lawyertool, com botão para analisar uma por vez.
Se o `.env` tiver `API_KEY`, informe a chave no ícone de chave no canto superior direito.

## Tarefas monitoradas, triagem e agenda (atualização)
- Os tipos de tarefa que entram na automação ficam em `src/config/tarefas.config.ts`
  (setor Revisão: Dar andamento RMI, Solicitar Documentos, documentação atualizada para ação judicial,
  Solicitar Documentos - Ação Nova, Complementar provas, Exigência INSS e Analisar Revisão).
- "Analisar Revisão - Material Interno" passa antes por uma **triagem** barata da IA: só segue para a
  análise completa se houver pedido de documento/informação a cliente ou empresa.
- Cada tarefa só é reanalisada quando muda (movimentação, comentário ou arquivo novo). Para forçar,
  marque "Reanalisar também as tarefas sem novidade" ou analise a tarefa individualmente.
- A análise roda sozinha nos horários de `AGENDA_HORARIOS` (padrão 06:30, segunda a sexta),
  enquanto o servidor estiver ligado.
- Contatos das empresas: importados do CSV da Data Table do n8n (`/api/contatos-empresas/importar`).
  Busca pelo nome exato; se não achar, por nome parecido (sem LTDA, ME, acentos). Se vários cadastros
  diferentes parecerem com o nome, nenhum é usado e a dúvida vai para a conferência.

## Estações, Início e DEX (atualização)
- O sistema é organizado em estações no menu lateral: **Início**, **Solicitação de documentos**
  (`/documentos`, com Visão geral, Solicitações, Execuções e Tarefas monitoradas) e **Atendimento externo** (`/atendimento`).
  Os endereços antigos (`/solicitacoes`, `/execucoes`, `/tarefas`) redirecionam para os novos.
- **Início**: resumo do dia por estação, links rápidos (editáveis, guardados no navegador) e o chat da DEX.
- **DEX**: assistente interna do escritório. Responde consultando o sistema por ferramentas **só de leitura**
  (panorama, solicitações, execuções, tarefas, atendimento da semana, contatos de empresas e este guia).
  Não envia, não conclui e não altera nada. As conversas ficam em `.dados/conversas-dex.json`.
  A personalidade e as regras dela estão em `src/prompts/dex.md`; o modelo em `OPENAI_MODELO_DEX`.
- Trava dos 3 envios ao cliente: a automação conta os comentários "Situação: ENVIADO" de contato com o cliente
  na tarefa (no mesmo modo, teste ou produção). A partir do 3º envio, a nova solicitação fica bloqueada e a equipe trata.

## Rota e despesas do atendente (atualização)

- Tela: **Atendimento externo → Rota e despesas** (`/atendimento/rota`).
- Mostra o carro no mapa (atualiza a cada 10 s), o trajeto do dia e da semana, as cidades do roteiro
  (verde = resolvida, amarelo = deixou pendência, roxo = está lá agora, cinza = a visitar), e os indicadores:
  pastas resolvidas nas cidades visitadas, km rodados (semana e hoje), pendências deixadas, ações novas,
  gastos da semana por categoria, litros abastecidos, km/L e R$/km.
- Botões **+ Gasto** (alimentação, combustível com litros, pedágio, estacionamento, hospedagem, manutenção, outros)
  e **+ Ação nova** (cliente, cidade, tipo de ação). Gastos lançados à mão podem ser apagados; os de exemplo não.
- Hoje o rastreador é **simulado** (`RASTREADOR_PROVEDOR=simulado`): o carro sai de Fraiburgo às 07:30 e percorre
  o roteiro de exemplo conforme o horário. Para ligar o rastreador real, implementar o provedor em
  `src/integrations/rastreador.integration.ts` (funções `obterPosicao` e `obterTrajetoDoDia`) — o resto da tela não muda.
- Dados salvos em `.dados/rota-despesas.json` e `.dados/rota-acoes-novas.json` (até migrar para o banco).
- Dependência nova: `npm install leaflet` e `npm install -D @types/leaflet`.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/rota?atendenteId=teste` | Painel completo (paradas, indicadores, por dia, pendências, ações, despesas, trajetos) |
| GET | `/api/rota/posicao?atendenteId=teste` | Só a posição atual do carro |
| POST | `/api/rota/despesas` | Registra gasto `{ atendenteId, categoria, valor, litros?, cidade?, descricao?, data? }` |
| DELETE | `/api/rota/despesas` | Apaga gasto `{ atendenteId, id }` |
| POST | `/api/rota/acoes-novas` | Registra ação nova `{ atendenteId, cliente, cidade, tipo, observacao?, data? }` |

// Roda uma vez quando o servidor do Next sobe: liga a agenda da análise automática e a leitura da caixa de e-mail.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { iniciarAgenda } = await import('@/automations/agenda.automation');
    iniciarAgenda();
    const { iniciarLeituraCaixa } = await import('@/automations/leitura-caixa.automation');
    iniciarLeituraCaixa();
  }
}

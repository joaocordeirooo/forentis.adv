// Roda uma vez quando o servidor do Next sobe: liga a agenda da análise automática.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { iniciarAgenda } = await import('@/automations/agenda.automation');
    iniciarAgenda();
  }
}

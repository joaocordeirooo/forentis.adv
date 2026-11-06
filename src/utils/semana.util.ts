// Semana atual (segunda a domingo) no fuso de São Paulo, em datas AAAA-MM-DD.
export function semanaAtual(referencia = new Date()) {
  const hoje = new Date(referencia.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const diaSemana = (hoje.getDay() + 6) % 7; // segunda = 0
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - diaSemana);
  const dia = (deslocamento: number) => {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + deslocamento);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return { inicio: dia(0), fim: dia(6), diasUteis: [0, 1, 2, 3, 4].map(dia) };
}

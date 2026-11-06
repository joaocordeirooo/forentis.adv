import { config } from '@/config/env.config';
import { listarExecucoes } from '@/repositories/execucao.repository';
import { criarExecucao, executarAnalise } from './analise-tarefas.automation';

// Agenda interna: roda a análise nos horários do AGENDA_HORARIOS (fuso de São Paulo),
// enquanto o servidor (npm run dev / npm start) estiver ligado.

function agoraEmSaoPaulo() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { data: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}`, diaSemana: dias[partes.weekday] };
}

const executadas = new Set<string>(); // "2026-11-06 06:30" já disparados

async function verificar() {
  const { horarios, dias } = config.agenda;
  const agora = agoraEmSaoPaulo();
  if (!dias.includes(agora.diaSemana) || !horarios.includes(agora.hora)) return;
  const chave = `${agora.data} ${agora.hora}`;
  if (executadas.has(chave)) return;
  executadas.add(chave);

  // Se o servidor reiniciou no mesmo minuto, não dispara duas vezes.
  const ultima = (await listarExecucoes())[0];
  if (ultima?.origem === 'agenda' && Date.now() - Date.parse(ultima.iniciadaEm) < 5 * 60_000) return;

  try {
    const execucao = await criarExecucao(null, { origem: 'agenda' });
    console.log(`[agenda] análise automática iniciada (${chave}) — execução ${execucao.id}`);
    await executarAnalise(execucao);
  } catch (erro) {
    console.error('[agenda] não foi possível iniciar a análise automática:', (erro as Error).message);
  }
}

export function iniciarAgenda() {
  const global = globalThis as unknown as { __agendaForentis?: boolean };
  if (global.__agendaForentis) return; // evita duas agendas quando o Next recarrega o código
  global.__agendaForentis = true;
  const { horarios } = config.agenda;
  if (!horarios.length) {
    console.log('[agenda] AGENDA_HORARIOS vazio: análise só manual.');
    return;
  }
  console.log(`[agenda] análise automática às ${horarios.join(', ')} (São Paulo).`);
  setInterval(() => void verificar(), 30_000);
}

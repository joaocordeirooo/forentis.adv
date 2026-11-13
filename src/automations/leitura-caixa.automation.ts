import { config, estaConfigurado } from '@/config/env.config';
import { lerCaixa } from '@/service/leitura-caixa.service';

// Lê a caixa de entrada de tempos em tempos (EMAIL_LEITURA_MINUTOS), enquanto o servidor estiver ligado.
export function iniciarLeituraCaixa() {
  const global = globalThis as unknown as { __leituraCaixaForentis?: boolean };
  if (global.__leituraCaixaForentis) return; // o Next recarrega o código em dev: liga uma vez só
  global.__leituraCaixaForentis = true;

  if (!estaConfigurado(() => config.caixaEmail)) {
    console.log('[caixa] e-mail não configurado no .env: leitura das respostas desligada.');
    return;
  }
  const minutos = config.caixaEmail.leituraMinutos;
  if (minutos <= 0) {
    console.log('[caixa] EMAIL_LEITURA_MINUTOS = 0: leitura das respostas só manual.');
    return;
  }

  console.log(`[caixa] lendo as respostas a cada ${minutos} min.`);
  const ler = () =>
    void lerCaixa('agenda').catch((erro) => console.error('[caixa] leitura falhou:', (erro as Error).message));
  setTimeout(ler, 20_000); // primeira leitura logo depois de subir
  setInterval(ler, minutos * 60_000);
}

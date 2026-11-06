import { config, estaConfigurado } from '@/config/env.config';

export async function verificarSaude(): Promise<Response> {
  return Response.json({
    ok: true,
    hora: new Date().toISOString(),
    modoTeste: config.automacao.modoTeste,
    configurado: {
      lawyertool: estaConfigurado(() => config.lawyertool),
      openai: estaConfigurado(() => config.openai),
      chatguru: estaConfigurado(() => config.chatguru),
      email: estaConfigurado(() => config.smtp),
      chaveApi: Boolean(config.api.chave),
    },
  });
}

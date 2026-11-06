import { resumoInicio } from '@/service/inicio.service';

export async function obterResumo(): Promise<Response> {
  return Response.json(await resumoInicio());
}

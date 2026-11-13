// Link para abrir a tarefa no Lawyertool (no navegador do funcionário).
// O modelo vem do .env (NEXT_PUBLIC_LAWYERTOOL_TAREFA_URL), com {id} no lugar do número da tarefa.
const MODELO = process.env.NEXT_PUBLIC_LAWYERTOOL_TAREFA_URL || 'https://lawyertool.damadvogados.com.br:6080/tar/tarefa/{id}';

export function linkTarefaLawyertool(tarefaId: number): string {
  return MODELO.replace('{id}', String(tarefaId));
}

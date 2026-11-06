import { redirect } from 'next/navigation';

// Endereço antigo: a tela agora fica na estação Solicitação de Documentos.
export default function Pagina() {
  redirect('/documentos/solicitacoes');
}

// Erro "conhecido" da aplicação: carrega o status HTTP que deve ser devolvido.
export class AppError extends Error {
  public readonly status: number;
  public readonly detalhes?: unknown;

  constructor(mensagem: string, status = 500, detalhes?: unknown) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.detalhes = detalhes;
  }
}

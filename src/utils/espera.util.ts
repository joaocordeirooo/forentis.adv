export function esperar(segundos: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, segundos * 1000));
}

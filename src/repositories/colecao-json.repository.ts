import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '@/config/env.config';

// Guarda uma lista de registros num arquivo JSON dentro da pasta de dados (.dados/).
// É o "banco" provisório: quando entrar o PostgreSQL, só os repositories mudam.
export class ColecaoJson<T extends { id: string }> {
  private fila: Promise<unknown> = Promise.resolve();

  constructor(private readonly nomeArquivo: string) {}

  private get caminho(): string {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), config.pastaDados, this.nomeArquivo);
  }

  private async ler(): Promise<T[]> {
    try {
      return JSON.parse(await readFile(this.caminho, 'utf8')) as T[];
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw erro;
    }
  }

  private async gravar(registros: T[]): Promise<void> {
    await mkdir(path.dirname(this.caminho), { recursive: true });
    const temporario = `${this.caminho}.tmp`;
    await writeFile(temporario, JSON.stringify(registros, null, 2), 'utf8');
    await rename(temporario, this.caminho); // troca de uma vez: não corrompe se o processo cair
  }

  // Executa uma alteração por vez, para duas gravações não se atropelarem.
  private emFila<R>(operacao: () => Promise<R>): Promise<R> {
    const resultado = this.fila.then(operacao, operacao);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  listar(): Promise<T[]> {
    return this.emFila(() => this.ler());
  }

  async obter(id: string): Promise<T | null> {
    const registros = await this.listar();
    return registros.find((registro) => registro.id === id) ?? null;
  }

  salvar(registro: T): Promise<T> {
    return this.emFila(async () => {
      const registros = await this.ler();
      const indice = registros.findIndex((r) => r.id === registro.id);
      if (indice >= 0) registros[indice] = registro;
      else registros.push(registro);
      await this.gravar(registros);
      return registro;
    });
  }

  salvarVarios(novos: T[]): Promise<void> {
    return this.emFila(async () => {
      const registros = await this.ler();
      for (const registro of novos) {
        const indice = registros.findIndex((r) => r.id === registro.id);
        if (indice >= 0) registros[indice] = registro;
        else registros.push(registro);
      }
      await this.gravar(registros);
    });
  }

  // Apaga os registros que atendem ao filtro.
  remover(filtro: (registro: T) => boolean): Promise<number> {
    return this.emFila(async () => {
      const registros = await this.ler();
      const restantes = registros.filter((r) => !filtro(r));
      await this.gravar(restantes);
      return registros.length - restantes.length;
    });
  }

  // Lê, altera e grava o registro de uma vez só.
  atualizar(id: string, alterar: (registro: T) => T): Promise<T | null> {
    return this.emFila(async () => {
      const registros = await this.ler();
      const indice = registros.findIndex((r) => r.id === id);
      if (indice < 0) return null;
      registros[indice] = alterar(registros[indice]);
      await this.gravar(registros);
      return registros[indice];
    });
  }
}

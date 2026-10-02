import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AnexoStoragePort } from "./anexo-storage.port";

@Injectable()
export class LocalDiskAnexoStorage implements AnexoStoragePort {
  private readonly raiz: string;

  constructor(config: ConfigService) {
    this.raiz = resolve(config.get<string>("ANEXOS_DIR") ?? ".data/anexos");
  }

  async salvar(chave: string, conteudo: Buffer): Promise<void> {
    const caminho = this.caminhoSeguro(chave);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, conteudo);
  }

  async ler(chave: string): Promise<Buffer> {
    try {
      return await readFile(this.caminhoSeguro(chave));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NotFoundException("Arquivo do anexo não encontrado no armazenamento.");
      }
      throw erro;
    }
  }

  async remover(chave: string): Promise<void> {
    await rm(this.caminhoSeguro(chave), { force: true });
  }

  // As chaves são geradas pelo servidor (uuid), mas o adapter não confia nisso:
  // qualquer chave que resolva para fora da raiz (ex.: "../") é recusada.
  private caminhoSeguro(chave: string): string {
    const caminho = resolve(this.raiz, chave);
    if (!caminho.startsWith(this.raiz + sep)) {
      throw new Error("Chave de armazenamento inválida.");
    }
    return caminho;
  }
}

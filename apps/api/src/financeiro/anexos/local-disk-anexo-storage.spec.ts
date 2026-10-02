import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { LocalDiskAnexoStorage } from "./local-disk-anexo-storage";

describe("LocalDiskAnexoStorage", () => {
  let raiz: string;
  let storage: LocalDiskAnexoStorage;

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), "anexos-spec-"));
    storage = new LocalDiskAnexoStorage({ get: () => raiz } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it("salva e devolve exatamente os mesmos bytes, criando subpastas", async () => {
    const conteudo = Buffer.from([0, 1, 2, 250, 251, 252, 253]);
    await storage.salvar("empresa-1/titulo-1/arquivo.pdf", conteudo);

    expect(existsSync(join(raiz, "empresa-1", "titulo-1", "arquivo.pdf"))).toBe(true);
    expect((await storage.ler("empresa-1/titulo-1/arquivo.pdf")).equals(conteudo)).toBe(true);
  });

  it("remover apaga o arquivo e é idempotente (remover de novo não falha)", async () => {
    await storage.salvar("a/b.pdf", Buffer.from("x"));
    await storage.remover("a/b.pdf");
    expect(existsSync(join(raiz, "a", "b.pdf"))).toBe(false);
    await expect(storage.remover("a/b.pdf")).resolves.toBeUndefined();
  });

  it("ler arquivo inexistente vira 404, não erro 500 de filesystem", async () => {
    await expect(storage.ler("nao/existe.pdf")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("recusa chaves que escapam da raiz (path traversal) em salvar, ler e remover", async () => {
    const fuga = "../fora.pdf";
    await expect(storage.salvar(fuga, Buffer.from("x"))).rejects.toThrow("Chave de armazenamento inválida");
    await expect(storage.ler(fuga)).rejects.toThrow("Chave de armazenamento inválida");
    await expect(storage.remover("../../etc/passwd")).rejects.toThrow("Chave de armazenamento inválida");
    expect(existsSync(join(raiz, "..", "fora.pdf"))).toBe(false);
  });

  it("recusa chave absoluta apontando pra outro lugar do disco", async () => {
    await expect(storage.salvar("/tmp/invasor.pdf", Buffer.from("x"))).rejects.toThrow(
      "Chave de armazenamento inválida",
    );
  });
});

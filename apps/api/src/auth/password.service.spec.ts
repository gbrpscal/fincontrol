import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("gera hashes diferentes para a mesma senha (salt aleatório) mas ambos validam", async () => {
    const hash1 = await service.hash("senha-correta-123");
    const hash2 = await service.hash("senha-correta-123");

    expect(hash1).not.toBe(hash2);
    await expect(service.compare("senha-correta-123", hash1)).resolves.toBe(true);
    await expect(service.compare("senha-correta-123", hash2)).resolves.toBe(true);
  });

  it("rejeita senha incorreta", async () => {
    const hash = await service.hash("senha-correta-123");
    await expect(service.compare("senha-errada", hash)).resolves.toBe(false);
  });
});

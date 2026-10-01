import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { ContextIdFactory } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import type { AuthenticatedUser } from "../src/auth/types";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantPrismaService } from "../src/prisma/tenant-prisma.service";

// Prova, através do caminho de código real da aplicação (não SQL cru como na
// validação manual do ADR 0002), que uma empresa nunca enxerga nem consegue
// gravar dado de outra — o requisito central de "isolamento de dados
// garantido de forma centralizada".

function usuarioDaEmpresa(empresaId: string): AuthenticatedUser {
  return { sub: "user-de-teste", membershipId: "membership-de-teste", empresaId, role: "OWNER", sessionId: "s" };
}

async function tenantPrismaPara(moduleRef: TestingModule, empresaId: string) {
  const contextId = ContextIdFactory.create();
  moduleRef.registerRequestByContextId<Partial<Request> & { user: AuthenticatedUser }>(
    { user: usuarioDaEmpresa(empresaId) } as Request & { user: AuthenticatedUser },
    contextId,
  );
  const service = await moduleRef.resolve(TenantPrismaService, contextId);
  return service.client;
}

describe("Isolamento multiempresa via TenantPrismaService", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let empresaAId: string;
  let empresaBId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);

    const empresaA = await prisma.empresa.create({
      data: { nome: "Empresa A (RLS)", documento: `rls-a-${randomUUID()}` },
    });
    const empresaB = await prisma.empresa.create({
      data: { nome: "Empresa B (RLS)", documento: `rls-b-${randomUUID()}` },
    });
    empresaAId = empresaA.id;
    empresaBId = empresaB.id;
  });

  afterAll(async () => {
    const clienteA = await tenantPrismaPara(moduleRef, empresaAId);
    const clienteB = await tenantPrismaPara(moduleRef, empresaBId);
    await clienteA.categoria.deleteMany({ where: { empresaId: empresaAId } });
    await clienteB.categoria.deleteMany({ where: { empresaId: empresaBId } });
    await prisma.empresa.deleteMany({ where: { id: { in: [empresaAId, empresaBId] } } });
    await moduleRef.close();
  });

  it("cada empresa só enxerga as próprias categorias", async () => {
    const clienteA = await tenantPrismaPara(moduleRef, empresaAId);
    const clienteB = await tenantPrismaPara(moduleRef, empresaBId);

    await clienteA.categoria.create({
      data: { empresaId: empresaAId, nome: "Categoria A", tipo: "DESPESA" },
    });
    await clienteB.categoria.create({
      data: { empresaId: empresaBId, nome: "Categoria B", tipo: "DESPESA" },
    });

    const vistasPorA = await clienteA.categoria.findMany();
    const vistasPorB = await clienteB.categoria.findMany();

    expect(vistasPorA.map((c) => c.nome)).toEqual(["Categoria A"]);
    expect(vistasPorB.map((c) => c.nome)).toEqual(["Categoria B"]);
  });

  it("rejeita a criação de uma categoria vazando para outra empresa", async () => {
    const clienteA = await tenantPrismaPara(moduleRef, empresaAId);

    await expect(
      clienteA.categoria.create({
        data: { empresaId: empresaBId, nome: "Tentativa de vazamento", tipo: "DESPESA" },
      }),
    ).rejects.toThrow();
  });

  it("sem contexto de empresa, o serviço recusa a usar o client (nunca cai pro client sem escopo)", async () => {
    const contextId = ContextIdFactory.create();
    moduleRef.registerRequestByContextId({} as Request, contextId);
    const service = await moduleRef.resolve(TenantPrismaService, contextId);

    expect(() => service.client).toThrow(/fora de uma request autenticada/);
  });
});

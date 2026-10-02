import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { ContextIdFactory } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AuditService } from "../src/audit/audit.service";
import type { AuthenticatedUser } from "../src/auth/types";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantPrismaService } from "../src/prisma/tenant-prisma.service";

async function resolverParaEmpresa(moduleRef: TestingModule, empresaId: string, userId: string) {
  const usuario: AuthenticatedUser = {
    sub: userId,
    membershipId: "membership-auditoria",
    empresaId,
    role: "OWNER",
    sessionId: "s",
  };
  const contextId = ContextIdFactory.create();
  moduleRef.registerRequestByContextId<Partial<Request> & { user: AuthenticatedUser }>(
    { user: usuario } as Request & { user: AuthenticatedUser },
    contextId,
  );
  return {
    audit: await moduleRef.resolve(AuditService, contextId),
    tenantPrisma: await moduleRef.resolve(TenantPrismaService, contextId),
  };
}

describe("AuditService", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let empresaAId: string;
  let empresaBId: string;
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);

    const user = await prisma.user.create({
      data: { nome: "Auditora", email: `aud-${randomUUID()}@fincontrol.dev`, senhaHash: "x" },
    });
    userId = user.id;
    const empresaA = await prisma.empresa.create({
      data: { nome: "Empresa A (auditoria)", documento: `aud-a-${randomUUID()}` },
    });
    const empresaB = await prisma.empresa.create({
      data: { nome: "Empresa B (auditoria)", documento: `aud-b-${randomUUID()}` },
    });
    empresaAId = empresaA.id;
    empresaBId = empresaB.id;
  });

  afterAll(async () => {
    const { tenantPrisma: tenantA } = await resolverParaEmpresa(moduleRef, empresaAId, userId);
    const { tenantPrisma: tenantB } = await resolverParaEmpresa(moduleRef, empresaBId, userId);
    await tenantA.client.auditLog.deleteMany({ where: { empresaId: empresaAId } });
    await tenantB.client.auditLog.deleteMany({ where: { empresaId: empresaBId } });
    await prisma.empresa.deleteMany({ where: { id: { in: [empresaAId, empresaBId] } } });
    await prisma.user.delete({ where: { id: userId } });
    await moduleRef.close();
  });

  it("grava empresa e autor do contexto automaticamente, com antes/depois", async () => {
    const { audit, tenantPrisma } = await resolverParaEmpresa(moduleRef, empresaAId, userId);

    await audit.registrar({
      entidade: "Titulo",
      entidadeId: "titulo-fake-1",
      acao: "CREATE",
      depois: { valorOriginal: "150.00" },
    });

    const registros = await tenantPrisma.client.auditLog.findMany({ where: { entidadeId: "titulo-fake-1" } });
    expect(registros).toHaveLength(1);
    expect(registros[0]?.empresaId).toBe(empresaAId);
    expect(registros[0]?.userId).toBe(userId);
    expect(registros[0]?.acao).toBe("CREATE");
    expect(registros[0]?.depois).toEqual({ valorOriginal: "150.00" });
  });

  it("um registro de auditoria de uma empresa não aparece pra outra", async () => {
    const { audit: auditA } = await resolverParaEmpresa(moduleRef, empresaAId, userId);
    const { tenantPrisma: tenantB } = await resolverParaEmpresa(moduleRef, empresaBId, userId);

    await auditA.registrar({ entidade: "Titulo", entidadeId: "titulo-fake-2", acao: "BAIXA" });

    const vistoPorB = await tenantB.client.auditLog.findMany({ where: { entidadeId: "titulo-fake-2" } });
    expect(vistoPorB).toHaveLength(0);
  });

  it("dentro de uma transação, a auditoria desaparece junto se a operação der rollback", async () => {
    const { audit, tenantPrisma } = await resolverParaEmpresa(moduleRef, empresaAId, userId);

    await expect(
      tenantPrisma.transaction(async (tx) => {
        await audit.registrar({ entidade: "Titulo", entidadeId: "titulo-rollback", acao: "UPDATE" }, tx);
        throw new Error("falha simulada depois de auditar");
      }),
    ).rejects.toThrow("falha simulada");

    const sobrou = await tenantPrisma.client.auditLog.findMany({ where: { entidadeId: "titulo-rollback" } });
    expect(sobrou).toHaveLength(0);
  });

  it("transaction() aplica o RLS: dentro dela só se enxerga a própria empresa", async () => {
    const { audit: auditA } = await resolverParaEmpresa(moduleRef, empresaAId, userId);
    const { tenantPrisma: tenantB } = await resolverParaEmpresa(moduleRef, empresaBId, userId);
    await auditA.registrar({ entidade: "Titulo", entidadeId: "titulo-visivel-so-pra-a", acao: "CREATE" });

    const visivelParaB = await tenantB.transaction((tx) =>
      tx.auditLog.findMany({ where: { entidadeId: "titulo-visivel-so-pra-a" } }),
    );
    expect(visivelParaB).toHaveLength(0);
  });
});

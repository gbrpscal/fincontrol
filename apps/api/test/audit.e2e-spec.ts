import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { ContextIdFactory } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { AuditService } from "../src/audit/audit.service";
import type { AuthenticatedUser } from "../src/auth/types";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantPrismaService } from "../src/prisma/tenant-prisma.service";

function usuarioDaEmpresa(empresaId: string): AuthenticatedUser {
  return { sub: "user-auditoria", membershipId: "membership-auditoria", empresaId, role: "OWNER", sessionId: "s" };
}

async function resolverParaEmpresa(moduleRef: TestingModule, empresaId: string) {
  const contextId = ContextIdFactory.create();
  moduleRef.registerRequestByContextId<Partial<Request> & { user: AuthenticatedUser }>(
    { user: usuarioDaEmpresa(empresaId) } as Request & { user: AuthenticatedUser },
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

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);

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
    const { tenantPrisma: tenantA } = await resolverParaEmpresa(moduleRef, empresaAId);
    const { tenantPrisma: tenantB } = await resolverParaEmpresa(moduleRef, empresaBId);
    await tenantA.client.auditLog.deleteMany({ where: { empresaId: empresaAId } });
    await tenantB.client.auditLog.deleteMany({ where: { empresaId: empresaBId } });
    await prisma.empresa.deleteMany({ where: { id: { in: [empresaAId, empresaBId] } } });
    await moduleRef.close();
  });

  it("grava a empresa do contexto automaticamente, com antes/depois", async () => {
    const { audit, tenantPrisma } = await resolverParaEmpresa(moduleRef, empresaAId);

    await audit.registrar({
      entidade: "Titulo",
      entidadeId: "titulo-fake-1",
      acao: "CREATE",
      depois: { valorOriginal: "150.00" },
    });

    const registros = await tenantPrisma.client.auditLog.findMany({ where: { entidadeId: "titulo-fake-1" } });
    expect(registros).toHaveLength(1);
    expect(registros[0]?.empresaId).toBe(empresaAId);
    expect(registros[0]?.acao).toBe("CREATE");
    expect(registros[0]?.depois).toEqual({ valorOriginal: "150.00" });
  });

  it("um registro de auditoria de uma empresa não aparece pra outra", async () => {
    const { audit: auditA } = await resolverParaEmpresa(moduleRef, empresaAId);
    const { tenantPrisma: tenantB } = await resolverParaEmpresa(moduleRef, empresaBId);

    await auditA.registrar({
      entidade: "Titulo",
      entidadeId: "titulo-fake-2",
      acao: "BAIXA",
    });

    const vistoPorB = await tenantB.client.auditLog.findMany({ where: { entidadeId: "titulo-fake-2" } });
    expect(vistoPorB).toHaveLength(0);
  });
});

import { Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth/types";
import { PrismaService } from "./prisma.service";

type RequestComUsuario = Request & { user?: AuthenticatedUser };

/**
 * Cliente Prisma com escopo de tenant — todo model protegido por Row-Level
 * Security (ver docs/adr/0002-multi-tenancy-isolation.md) só deve ser
 * consultado através deste serviço, nunca do PrismaService "cru".
 *
 * Como funciona: cada operação é reescrita para rodar dentro de uma
 * transação de duas etapas — primeiro `SET LOCAL app.current_empresa_id`,
 * depois a query de verdade — usando `$transaction([...])` para garantir que
 * as duas rodem na mesma conexão/transação (RLS lê `current_setting` da
 * transação atual; se cada etapa pegasse uma conexão diferente do pool, o
 * SET LOCAL não valeria para a query seguinte).
 *
 * Scope.REQUEST: uma instância nova por request, resolvida via injeção do
 * `REQUEST` do Nest — não usa AsyncLocalStorage porque o próprio sistema de
 * DI por escopo do Nest já dá isolamento por request "de graça".
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  private extendedClient: ReturnType<TenantPrismaService["construirClienteComEscopo"]> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly request: RequestComUsuario,
  ) {}

  get client() {
    if (!this.extendedClient) {
      this.extendedClient = this.construirClienteComEscopo(this.empresaId);
    }
    return this.extendedClient;
  }

  // Exposto para serviços que precisam montar o valor de `empresaId` de uma
  // linha nova (ex.: AuditService) — a extensão abaixo só garante o SET
  // LOCAL da sessão, não preenche colunas sozinha.
  get empresaId(): string {
    const empresaId = this.request.user?.empresaId;
    if (!empresaId) {
      throw new Error(
        "TenantPrismaService foi injetado fora de uma request autenticada com empresa ativa.",
      );
    }
    return empresaId;
  }

  private construirClienteComEscopo(empresaId: string) {
    const prisma = this.prisma;
    return prisma.$extends({
      name: "tenant-rls",
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const [, resultado] = await prisma.$transaction([
              prisma.$executeRaw`SELECT set_config('app.current_empresa_id', ${empresaId}, true)`,
              query(args),
            ]);
            return resultado;
          },
        },
      },
    });
  }
}

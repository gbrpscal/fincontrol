import { Injectable, Scope } from "@nestjs/common";
import type { AuditAcao, Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

export interface RegistrarAuditoriaInput {
  entidade: string;
  entidadeId: string;
  acao: AuditAcao;
  userId?: string;
  antes?: Prisma.InputJsonValue;
  depois?: Prisma.InputJsonValue;
}

// Escopo de request (igual o TenantPrismaService que consome): toda alteração
// em dado financeiro passa por aqui — quem, quando, antes/depois (requisito
// não funcional). `empresaId` nunca é parâmetro: vem sempre do contexto da
// request autenticada, nunca de algo que o chamador possa errar/forjar.
@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    // exactOptionalPropertyTypes: as chaves opcionais só entram no objeto
    // quando de fato têm valor — passar `undefined` explicitamente não é o
    // mesmo que omitir a chave para o Prisma.
    await this.tenantPrisma.client.auditLog.create({
      data: {
        empresaId: this.tenantPrisma.empresaId,
        entidade: input.entidade,
        entidadeId: input.entidadeId,
        acao: input.acao,
        ...(input.userId !== undefined && { userId: input.userId }),
        ...(input.antes !== undefined && { antes: input.antes }),
        ...(input.depois !== undefined && { depois: input.depois }),
      },
    });
  }
}

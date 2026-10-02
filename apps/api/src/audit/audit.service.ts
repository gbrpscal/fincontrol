import { Injectable, Scope } from "@nestjs/common";
import type { AuditAcao, Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";

export interface RegistrarAuditoriaInput {
  entidade: string;
  entidadeId: string;
  acao: AuditAcao;
  antes?: Prisma.InputJsonValue;
  depois?: Prisma.InputJsonValue;
}

// Escopo de request (igual o TenantPrismaService que consome): toda alteração
// em dado financeiro passa por aqui — quem, quando, antes/depois (requisito
// não funcional). `empresaId` e `userId` nunca são parâmetros: vêm sempre do
// contexto da request autenticada, nunca de algo que o chamador possa
// errar/forjar.
@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // Com `tx`, o registro entra na MESMA transação da operação auditada — se a
  // operação falhar e der rollback, a auditoria some junto (e vice-versa:
  // não existe alteração financeira sem trilha). Sem `tx`, grava avulso.
  async registrar(input: RegistrarAuditoriaInput, tx?: Prisma.TransactionClient): Promise<void> {
    // exactOptionalPropertyTypes: as chaves opcionais só entram no objeto
    // quando de fato têm valor — passar `undefined` explicitamente não é o
    // mesmo que omitir a chave para o Prisma.
    const data = {
      empresaId: this.tenantPrisma.empresaId,
      userId: this.tenantPrisma.userId,
      entidade: input.entidade,
      entidadeId: input.entidadeId,
      acao: input.acao,
      ...(input.antes !== undefined && { antes: input.antes }),
      ...(input.depois !== undefined && { depois: input.depois }),
    };

    if (tx) {
      await tx.auditLog.create({ data });
    } else {
      await this.tenantPrisma.client.auditLog.create({ data });
    }
  }
}

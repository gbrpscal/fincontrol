import { Injectable } from "@nestjs/common";
import type { CriarClienteFornecedorInput } from "@fincontrol/shared";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";

@Injectable()
export class ClientesFornecedoresService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  listar() {
    return this.tenantPrisma.client.clienteFornecedor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
  }

  criar(input: CriarClienteFornecedorInput) {
    return this.tenantPrisma.client.clienteFornecedor.create({
      data: {
        empresaId: this.tenantPrisma.empresaId,
        nome: input.nome,
        tipo: input.tipo,
        ...(input.documento !== undefined && { documento: input.documento }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.telefone !== undefined && { telefone: input.telefone }),
      },
    });
  }
}

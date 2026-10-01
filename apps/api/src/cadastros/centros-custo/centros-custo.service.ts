import { Injectable } from "@nestjs/common";
import type { CriarCentroCustoInput } from "@fincontrol/shared";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";

@Injectable()
export class CentrosCustoService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  listar() {
    return this.tenantPrisma.client.centroCusto.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
  }

  criar(input: CriarCentroCustoInput) {
    return this.tenantPrisma.client.centroCusto.create({
      data: { empresaId: this.tenantPrisma.empresaId, nome: input.nome },
    });
  }
}

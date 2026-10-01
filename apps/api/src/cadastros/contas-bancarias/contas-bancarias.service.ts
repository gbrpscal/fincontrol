import { Injectable } from "@nestjs/common";
import type { CriarContaBancariaManualInput } from "@fincontrol/shared";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";

@Injectable()
export class ContasBancariasService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  listar() {
    return this.tenantPrisma.client.contaBancaria.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
  }

  criar(input: CriarContaBancariaManualInput) {
    // Fase 2: só origem MANUAL. PLUGGY entra na Fase 4, atrás do
    // BankingProviderPort (ADR 0003) — nunca criada diretamente por aqui.
    return this.tenantPrisma.client.contaBancaria.create({
      data: {
        empresaId: this.tenantPrisma.empresaId,
        nome: input.nome,
        tipo: input.tipo,
        origem: "MANUAL",
        saldoAtual: input.saldoInicial,
      },
    });
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import type { AtualizarCategoriaInput, CriarCategoriaInput } from "@fincontrol/shared";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";

@Injectable()
export class CategoriasService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  listar() {
    return this.tenantPrisma.client.categoria.findMany({
      where: { ativo: true },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    });
  }

  async criar(input: CriarCategoriaInput) {
    if (input.parentId) {
      // A constraint de FK no Postgres não é filtrada por RLS (roda com
      // privilégio elevado internamente) — sem esta checagem, seria possível
      // criar uma categoria com parentId de outra empresa (a constraint de
      // chave estrangeira só exige que a linha exista, não que seja "minha").
      // Buscar pelo client com escopo de tenant usa a própria RLS como
      // verificação: se a linha não aparece, ou não existe ou é de outra
      // empresa — nos dois casos, 404.
      const pai = await this.tenantPrisma.client.categoria.findUnique({
        where: { id: input.parentId },
      });
      if (!pai) {
        throw new NotFoundException("Categoria pai não encontrada.");
      }
    }

    return this.tenantPrisma.client.categoria.create({
      data: {
        empresaId: this.tenantPrisma.empresaId,
        nome: input.nome,
        tipo: input.tipo,
        ...(input.parentId !== undefined && { parentId: input.parentId }),
      },
    });
  }

  async atualizar(id: string, input: AtualizarCategoriaInput) {
    const existente = await this.tenantPrisma.client.categoria.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException("Categoria não encontrada.");
    }

    return this.tenantPrisma.client.categoria.update({
      where: { id },
      data: {
        ...(input.nome !== undefined && { nome: input.nome }),
        ...(input.ativo !== undefined && { ativo: input.ativo }),
      },
    });
  }
}

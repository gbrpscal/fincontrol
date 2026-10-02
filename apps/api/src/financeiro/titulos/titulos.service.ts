import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  AtualizarTituloInput,
  CriarTituloInput,
  ListarTitulosQuery,
} from "@fincontrol/shared";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../../audit/audit.service";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { dataUtc } from "../datas";
import { snapshotTitulo } from "./titulo-snapshot";
import { travarTitulo } from "./titulo-lock";

function exigirAtivo(nome: string, registro: { ativo: boolean } | null): void {
  if (!registro) {
    throw new NotFoundException(`${nome} não encontrado(a).`);
  }
  if (!registro.ativo) {
    throw new UnprocessableEntityException(`${nome} está inativo(a).`);
  }
}

interface Referencias {
  categoriaId?: string | undefined;
  centroCustoId?: string | undefined;
  clienteFornecedorId?: string | undefined;
  contaBancariaPrevistaId?: string | undefined;
}

@Injectable()
export class TitulosService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  listar(filtro: ListarTitulosQuery) {
    const vencimento = {
      ...(filtro.vencimentoDe !== undefined && { gte: dataUtc(filtro.vencimentoDe) }),
      ...(filtro.vencimentoAte !== undefined && { lte: dataUtc(filtro.vencimentoAte) }),
    };

    return this.tenantPrisma.client.titulo.findMany({
      where: {
        ...(filtro.tipo !== undefined && { tipo: filtro.tipo }),
        ...(filtro.status !== undefined && { status: filtro.status }),
        ...(Object.keys(vencimento).length > 0 && { dataVencimento: vencimento }),
      },
      orderBy: [{ dataVencimento: "asc" }, { createdAt: "asc" }],
    });
  }

  async obter(id: string) {
    const titulo = await this.tenantPrisma.client.titulo.findUnique({
      where: { id },
      include: {
        baixas: { orderBy: { data: "asc" }, include: { estornoSolicitacao: true } },
      },
    });
    if (!titulo) {
      throw new NotFoundException("Título não encontrado.");
    }
    return titulo;
  }

  async criar(input: CriarTituloInput) {
    await this.validarReferencias(input);

    return this.tenantPrisma.transaction(async (tx) => {
      const titulo = await tx.titulo.create({
        data: {
          empresaId: this.tenantPrisma.empresaId,
          tipo: input.tipo,
          descricao: input.descricao,
          valorOriginal: input.valorOriginal,
          saldoAberto: input.valorOriginal,
          categoriaId: input.categoriaId,
          dataEmissao: dataUtc(input.dataEmissao),
          dataVencimento: dataUtc(input.dataVencimento),
          ...(input.centroCustoId !== undefined && { centroCustoId: input.centroCustoId }),
          ...(input.clienteFornecedorId !== undefined && {
            clienteFornecedorId: input.clienteFornecedorId,
          }),
          ...(input.contaBancariaPrevistaId !== undefined && {
            contaBancariaPrevistaId: input.contaBancariaPrevistaId,
          }),
        },
      });

      await this.audit.registrar(
        { entidade: "Titulo", entidadeId: titulo.id, acao: "CREATE", depois: snapshotTitulo(titulo) },
        tx,
      );
      return titulo;
    });
  }

  async atualizar(id: string, input: AtualizarTituloInput) {
    await this.validarReferencias(input);

    return this.tenantPrisma.transaction(async (tx) => {
      await travarTitulo(tx, id);
      const atual = await tx.titulo.findUnique({ where: { id } });
      if (!atual) {
        throw new NotFoundException("Título não encontrado.");
      }
      if (atual.status === "CANCELADO") {
        throw new ConflictException("Título cancelado não pode ser editado.");
      }

      const mexeNoTravado = input.valorOriginal !== undefined || input.dataVencimento !== undefined;
      if (mexeNoTravado) {
        // Regra confirmada: com baixa ativa, valor e vencimento ficam
        // imutáveis (preserva a trilha financeira). Para mudar, estorna antes.
        const baixasAtivas = await tx.baixa.count({ where: { tituloId: id, estornadaEm: null } });
        if (baixasAtivas > 0) {
          throw new ConflictException(
            "Título com baixa ativa: valor e vencimento não podem ser alterados. Estorne as baixas antes.",
          );
        }
      }

      if (
        input.dataVencimento !== undefined &&
        dataUtc(input.dataVencimento).getTime() < atual.dataEmissao.getTime()
      ) {
        throw new UnprocessableEntityException("O vencimento não pode ser anterior à emissão.");
      }

      const data: Prisma.TituloUncheckedUpdateInput = {
        ...(input.descricao !== undefined && { descricao: input.descricao }),
        ...(input.categoriaId !== undefined && { categoriaId: input.categoriaId }),
        ...(input.centroCustoId !== undefined && { centroCustoId: input.centroCustoId }),
        ...(input.clienteFornecedorId !== undefined && {
          clienteFornecedorId: input.clienteFornecedorId,
        }),
        ...(input.dataVencimento !== undefined && { dataVencimento: dataUtc(input.dataVencimento) }),
        // Sem baixa ativa (garantido acima), saldo em aberto == valor original.
        ...(input.valorOriginal !== undefined && {
          valorOriginal: input.valorOriginal,
          saldoAberto: input.valorOriginal,
        }),
      };

      const atualizado = await tx.titulo.update({ where: { id }, data });
      await this.audit.registrar(
        {
          entidade: "Titulo",
          entidadeId: id,
          acao: "UPDATE",
          antes: snapshotTitulo(atual),
          depois: snapshotTitulo(atualizado),
        },
        tx,
      );
      return atualizado;
    });
  }

  async cancelar(id: string) {
    return this.tenantPrisma.transaction(async (tx) => {
      await travarTitulo(tx, id);
      const atual = await tx.titulo.findUnique({ where: { id } });
      if (!atual) {
        throw new NotFoundException("Título não encontrado.");
      }
      if (atual.status === "CANCELADO") {
        throw new ConflictException("Título já está cancelado.");
      }
      const baixasAtivas = await tx.baixa.count({ where: { tituloId: id, estornadaEm: null } });
      if (baixasAtivas > 0) {
        throw new ConflictException("Título com baixa ativa não pode ser cancelado. Estorne as baixas antes.");
      }

      const cancelado = await tx.titulo.update({ where: { id }, data: { status: "CANCELADO" } });
      await this.audit.registrar(
        {
          entidade: "Titulo",
          entidadeId: id,
          acao: "UPDATE",
          antes: snapshotTitulo(atual),
          depois: snapshotTitulo(cancelado),
        },
        tx,
      );
      return cancelado;
    });
  }

  // A FK do Postgres não é filtrada por RLS (ver CategoriasService): sem
  // buscar pelo client com escopo de tenant, um id de outra empresa passaria.
  private async validarReferencias(refs: Referencias): Promise<void> {
    const client = this.tenantPrisma.client;
    if (refs.categoriaId !== undefined) {
      exigirAtivo("Categoria", await client.categoria.findUnique({ where: { id: refs.categoriaId } }));
    }
    if (refs.centroCustoId !== undefined) {
      exigirAtivo("Centro de custo", await client.centroCusto.findUnique({ where: { id: refs.centroCustoId } }));
    }
    if (refs.clienteFornecedorId !== undefined) {
      exigirAtivo(
        "Cliente/fornecedor",
        await client.clienteFornecedor.findUnique({ where: { id: refs.clienteFornecedorId } }),
      );
    }
    if (refs.contaBancariaPrevistaId !== undefined) {
      exigirAtivo(
        "Conta bancária",
        await client.contaBancaria.findUnique({ where: { id: refs.contaBancariaPrevistaId } }),
      );
    }
  }
}

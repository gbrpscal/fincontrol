import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ListarEstornosQuery,
  RejeitarEstornoInput,
  SolicitarEstornoInput,
} from "@fincontrol/shared";
import { AuditService } from "../../audit/audit.service";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { travarTitulo } from "../titulos/titulo-lock";
import { snapshotTitulo } from "../titulos/titulo-snapshot";

@Injectable()
export class EstornosService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  listar(filtro: ListarEstornosQuery) {
    return this.tenantPrisma.client.estornoSolicitacao.findMany({
      where: { ...(filtro.status !== undefined && { status: filtro.status }) },
      include: { baixa: { include: { titulo: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  solicitar(baixaId: string, input: SolicitarEstornoInput) {
    return this.tenantPrisma.transaction(async (tx) => {
      const baixaInicial = await tx.baixa.findUnique({ where: { id: baixaId } });
      if (!baixaInicial) {
        throw new NotFoundException("Baixa não encontrada.");
      }
      await travarTitulo(tx, baixaInicial.tituloId);

      // Relê depois do lock: outra requisição pode ter estornado nesse meio tempo.
      const baixa = await tx.baixa.findUniqueOrThrow({ where: { id: baixaId } });
      if (baixa.estornadaEm) {
        throw new ConflictException("Esta baixa já foi estornada.");
      }

      const userId = this.tenantPrisma.userId;
      const existente = await tx.estornoSolicitacao.findUnique({ where: { baixaId } });
      if (existente?.status === "PENDENTE") {
        throw new ConflictException("Já existe uma solicitação de estorno pendente para esta baixa.");
      }

      // baixaId é único na tabela: uma solicitação rejeitada é reaberta (não
      // criada de novo), guardando o novo motivo e solicitante.
      const estorno = existente
        ? await tx.estornoSolicitacao.update({
            where: { id: existente.id },
            data: {
              status: "PENDENTE",
              motivo: input.motivo,
              solicitadoPor: userId,
              aprovadoPor: null,
              aprovadoEm: null,
            },
          })
        : await tx.estornoSolicitacao.create({
            data: { baixaId, motivo: input.motivo, solicitadoPor: userId },
          });

      await this.audit.registrar(
        {
          entidade: "Titulo",
          entidadeId: baixa.tituloId,
          acao: "ESTORNO_SOLICITADO",
          depois: { estornoId: estorno.id, baixaId, motivo: input.motivo, reaberta: existente !== null },
        },
        tx,
      );
      return estorno;
    });
  }

  aprovar(estornoId: string) {
    return this.tenantPrisma.transaction(async (tx) => {
      const { estorno, baixa } = await this.carregarPendente(tx, estornoId);
      this.exigirOutroUsuario(estorno.solicitadoPor);

      const titulo = await tx.titulo.findUniqueOrThrow({ where: { id: baixa.tituloId } });

      // Mesma conta do cálculo da baixa: só o principal volta pro saldo; o
      // caixa devolvido é o valor efetivamente pago.
      const principal = baixa.valorPago.minus(baixa.juros).minus(baixa.multa).plus(baixa.desconto);
      const novoSaldo = titulo.saldoAberto.plus(principal);
      const novoStatus = novoSaldo.equals(titulo.valorOriginal) ? "ABERTO" : "PARCIAL";

      // Transições condicionais (compare-and-set): mesmo que o lock do título
      // falhasse, só UMA transação consegue mudar PENDENTE → APROVADO e
      // marcar a baixa como estornada; as demais veem count 0 e abortam antes
      // de mexer em qualquer saldo. A correção não depende de timing.
      const agora = new Date();
      const decidida = await tx.estornoSolicitacao.updateMany({
        where: { id: estorno.id, status: "PENDENTE" },
        data: { status: "APROVADO", aprovadoPor: this.tenantPrisma.userId, aprovadoEm: agora },
      });
      const baixaMarcada = await tx.baixa.updateMany({
        where: { id: baixa.id, estornadaEm: null },
        data: { estornadaEm: agora },
      });
      if (decidida.count !== 1 || baixaMarcada.count !== 1) {
        throw new ConflictException("Esta solicitação já foi decidida por outro usuário.");
      }
      const atualizado = await tx.titulo.update({
        where: { id: titulo.id },
        data: { saldoAberto: novoSaldo.toFixed(2), status: novoStatus },
      });
      await tx.contaBancaria.update({
        where: { id: baixa.contaBancariaId },
        data: {
          saldoAtual:
            titulo.tipo === "PAGAR"
              ? { increment: baixa.valorPago }
              : { decrement: baixa.valorPago },
        },
      });

      await this.audit.registrar(
        {
          entidade: "Titulo",
          entidadeId: titulo.id,
          acao: "ESTORNO_APROVADO",
          antes: snapshotTitulo(titulo),
          depois: {
            ...snapshotTitulo(atualizado),
            estorno: {
              id: estorno.id,
              baixaId: baixa.id,
              solicitadoPor: estorno.solicitadoPor,
              principalDevolvido: principal.toFixed(2),
            },
          },
        },
        tx,
      );
      return { estorno: { ...estorno, status: "APROVADO" as const }, titulo: atualizado };
    });
  }

  rejeitar(estornoId: string, input: RejeitarEstornoInput) {
    return this.tenantPrisma.transaction(async (tx) => {
      const { estorno, baixa } = await this.carregarPendente(tx, estornoId);
      this.exigirOutroUsuario(estorno.solicitadoPor);

      const decidida = await tx.estornoSolicitacao.updateMany({
        where: { id: estorno.id, status: "PENDENTE" },
        data: {
          status: "REJEITADO",
          aprovadoPor: this.tenantPrisma.userId,
          aprovadoEm: new Date(),
        },
      });
      if (decidida.count !== 1) {
        throw new ConflictException("Esta solicitação já foi decidida por outro usuário.");
      }
      const rejeitado = await tx.estornoSolicitacao.findUniqueOrThrow({ where: { id: estorno.id } });

      await this.audit.registrar(
        {
          entidade: "Titulo",
          entidadeId: baixa.tituloId,
          acao: "ESTORNO_REJEITADO",
          depois: { estornoId: estorno.id, baixaId: baixa.id, motivoRejeicao: input.motivo },
        },
        tx,
      );
      return rejeitado;
    });
  }

  // Trava o título antes de reler a solicitação: duas decisões simultâneas
  // sobre o mesmo estorno (aprovar + aprovar) não podem as duas passar.
  private async carregarPendente(
    tx: Parameters<Parameters<TenantPrismaService["transaction"]>[0]>[0],
    estornoId: string,
  ) {
    const inicial = await tx.estornoSolicitacao.findUnique({
      where: { id: estornoId },
      include: { baixa: true },
    });
    if (!inicial) {
      throw new NotFoundException("Solicitação de estorno não encontrada.");
    }
    await travarTitulo(tx, inicial.baixa.tituloId);

    const estorno = await tx.estornoSolicitacao.findUniqueOrThrow({
      where: { id: estornoId },
      include: { baixa: true },
    });
    if (estorno.status !== "PENDENTE") {
      throw new ConflictException(`Esta solicitação já foi decidida (${estorno.status}).`);
    }
    if (estorno.baixa.estornadaEm) {
      throw new ConflictException("Esta baixa já foi estornada.");
    }
    return { estorno, baixa: estorno.baixa };
  }

  // Dupla checagem confirmada: quem pede não decide. Comparação feita com o
  // userId do token, nunca com algo vindo do corpo da requisição.
  private exigirOutroUsuario(solicitadoPor: string): void {
    if (solicitadoPor === this.tenantPrisma.userId) {
      throw new ForbiddenException("Quem solicitou o estorno não pode decidi-lo. Peça a outro usuário.");
    }
  }
}

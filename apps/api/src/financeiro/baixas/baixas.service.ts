import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { BaixaInvalidaError, calcularBaixa, type RegistrarBaixaInput } from "@fincontrol/shared";
import { AuditService } from "../../audit/audit.service";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { dataUtc } from "../datas";
import { travarTitulo } from "../titulos/titulo-lock";
import { snapshotTitulo } from "../titulos/titulo-snapshot";

@Injectable()
export class BaixasService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  // Tudo na mesma transação: linha da baixa, saldo do título, saldo da conta
  // bancária e auditoria. Ou tudo acontece, ou nada (requisito: operações que
  // afetam saldo sempre transacionais).
  registrar(tituloId: string, input: RegistrarBaixaInput) {
    return this.tenantPrisma.transaction(async (tx) => {
      await travarTitulo(tx, tituloId);

      const titulo = await tx.titulo.findUnique({ where: { id: tituloId } });
      if (!titulo) {
        throw new NotFoundException("Título não encontrado.");
      }
      if (titulo.status === "CANCELADO") {
        throw new ConflictException("Título cancelado não recebe baixa.");
      }
      if (titulo.status === "PAGO") {
        throw new ConflictException("Título já está quitado.");
      }

      const conta = await tx.contaBancaria.findUnique({ where: { id: input.contaBancariaId } });
      if (!conta) {
        throw new NotFoundException("Conta bancária não encontrada.");
      }
      if (!conta.ativo) {
        throw new UnprocessableEntityException("Conta bancária está inativa.");
      }

      let calculo;
      try {
        calculo = calcularBaixa({
          saldoAberto: titulo.saldoAberto.toFixed(2),
          valorPago: input.valorPago,
          juros: input.juros,
          multa: input.multa,
          desconto: input.desconto,
        });
      } catch (erro) {
        if (erro instanceof BaixaInvalidaError) {
          throw new UnprocessableEntityException({
            statusCode: 422,
            message: erro.message,
            codigo: erro.codigo,
          });
        }
        throw erro;
      }

      const baixa = await tx.baixa.create({
        data: {
          tituloId,
          valorPago: input.valorPago,
          juros: input.juros,
          multa: input.multa,
          desconto: input.desconto,
          data: dataUtc(input.data),
          contaBancariaId: input.contaBancariaId,
          criadoPor: this.tenantPrisma.userId,
        },
      });

      const atualizado = await tx.titulo.update({
        where: { id: tituloId },
        data: {
          saldoAberto: calculo.novoSaldo,
          status: calculo.quitado ? "PAGO" : "PARCIAL",
        },
      });

      // O caixa movimentado é o valor efetivamente pago (principal + juros +
      // multa − desconto): pagar sai da conta, receber entra.
      await tx.contaBancaria.update({
        where: { id: input.contaBancariaId },
        data: {
          saldoAtual:
            titulo.tipo === "PAGAR"
              ? { decrement: input.valorPago }
              : { increment: input.valorPago },
        },
      });

      await this.audit.registrar(
        {
          entidade: "Titulo",
          entidadeId: tituloId,
          acao: "BAIXA",
          antes: snapshotTitulo(titulo),
          depois: {
            ...snapshotTitulo(atualizado),
            baixa: {
              id: baixa.id,
              valorPago: input.valorPago,
              juros: input.juros,
              multa: input.multa,
              desconto: input.desconto,
              principalQuitado: calculo.principalQuitado,
              contaBancariaId: input.contaBancariaId,
            },
          },
        },
        tx,
      );

      return { baixa, titulo: atualizado };
    });
  }
}

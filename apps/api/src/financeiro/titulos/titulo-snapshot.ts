import type { Prisma, Titulo } from "@prisma/client";
import { formatarData } from "../datas";

// Foto do título para o AuditLog (antes/depois). Decimal vira string com 2
// casas — nunca number — e datas viram "YYYY-MM-DD".
export function snapshotTitulo(titulo: Titulo): Prisma.InputJsonObject {
  return {
    id: titulo.id,
    tipo: titulo.tipo,
    descricao: titulo.descricao,
    valorOriginal: titulo.valorOriginal.toFixed(2),
    saldoAberto: titulo.saldoAberto.toFixed(2),
    status: titulo.status,
    categoriaId: titulo.categoriaId,
    centroCustoId: titulo.centroCustoId,
    clienteFornecedorId: titulo.clienteFornecedorId,
    contaBancariaPrevistaId: titulo.contaBancariaPrevistaId,
    dataEmissao: formatarData(titulo.dataEmissao),
    dataVencimento: formatarData(titulo.dataVencimento),
  };
}

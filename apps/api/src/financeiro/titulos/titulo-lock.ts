import type { Prisma } from "@prisma/client";

// Trava a linha do título até o fim da transação. Sem isso, duas baixas
// simultâneas leriam o mesmo saldo e as duas passariam na validação
// ("quita no máximo o saldo"), estourando o título. Com o FOR UPDATE, a
// segunda espera a primeira commitar e já lê o saldo atualizado.
export async function travarTitulo(tx: Prisma.TransactionClient, tituloId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM titulos WHERE id = ${tituloId} FOR UPDATE`;
}

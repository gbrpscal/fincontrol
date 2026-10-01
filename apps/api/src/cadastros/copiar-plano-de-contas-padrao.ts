import type { CategoriaTemplate, Prisma } from "@prisma/client";

// Copia a árvore global de CategoriaTemplate (plano de contas padrão, seedado
// via prisma/seed.ts) para a Categoria da empresa recém-criada — decisão
// confirmada: template + customização, nunca "do zero". Chamada de dentro da
// mesma transação que cria User/Empresa/Membership em AuthService.registrar,
// pra tudo nascer atômico junto.
export async function copiarPlanoDeContasPadrao(
  tx: Prisma.TransactionClient,
  empresaId: string,
): Promise<void> {
  // Categoria tem RLS — sem isto, o INSERT seguinte é rejeitado pelo
  // Postgres (WITH CHECK falha com current_empresa_id vazio). Válido só até
  // o fim desta transação (set_config com último argumento `true`).
  await tx.$executeRaw`SELECT set_config('app.current_empresa_id', ${empresaId}, true)`;

  const templates = await tx.categoriaTemplate.findMany();
  const filhasPorPai = new Map<string | null, CategoriaTemplate[]>();
  for (const template of templates) {
    const chave = template.parentTemplateId;
    const lista = filhasPorPai.get(chave) ?? [];
    lista.push(template);
    filhasPorPai.set(chave, lista);
  }

  async function copiarNivel(parentTemplateId: string | null, parentCategoriaId: string | null) {
    for (const template of filhasPorPai.get(parentTemplateId) ?? []) {
      const categoria = await tx.categoria.create({
        data: {
          empresaId,
          nome: template.nome,
          tipo: template.tipo,
          parentId: parentCategoriaId,
          origemTemplateId: template.id,
        },
      });
      await copiarNivel(template.id, categoria.id);
    }
  }

  await copiarNivel(null, null);
}

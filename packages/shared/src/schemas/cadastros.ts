import { z } from "zod";

// ---------------------------------------------------------------------------
// Plano de contas (categorias)
// ---------------------------------------------------------------------------

export const categoriaTipoSchema = z.enum(["RECEITA", "CUSTO", "DESPESA"]);

export const criarCategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  tipo: categoriaTipoSchema,
  parentId: z.string().uuid().optional(),
});
export type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;

export const atualizarCategoriaSchema = z
  .object({
    nome: z.string().trim().min(2).max(120).optional(),
    ativo: z.boolean().optional(),
  })
  .refine((data) => data.nome !== undefined || data.ativo !== undefined, {
    message: "Informe ao menos um campo para atualizar.",
  });
export type AtualizarCategoriaInput = z.infer<typeof atualizarCategoriaSchema>;

// ---------------------------------------------------------------------------
// Centro de custo
// ---------------------------------------------------------------------------

export const criarCentroCustoSchema = z.object({
  nome: z.string().trim().min(2).max(120),
});
export type CriarCentroCustoInput = z.infer<typeof criarCentroCustoSchema>;

// ---------------------------------------------------------------------------
// Cliente / Fornecedor
// ---------------------------------------------------------------------------

export const clienteFornecedorTipoSchema = z.enum(["CLIENTE", "FORNECEDOR", "AMBOS"]);

// Valida só o formato (quantidade de dígitos de CPF/CNPJ), não o dígito
// verificador — ficaria sobre-engenheirado pra esta fase; documentado como
// limitação conhecida.
const documentoSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$|^\d{14}$/, "Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ), sem formatação.");

export const criarClienteFornecedorSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  documento: documentoSchema.optional(),
  tipo: clienteFornecedorTipoSchema,
  email: z.string().trim().email().optional(),
  telefone: z.string().trim().min(8).max(20).optional(),
});
export type CriarClienteFornecedorInput = z.infer<typeof criarClienteFornecedorSchema>;

// ---------------------------------------------------------------------------
// Conta bancária (manual — Fase 2; origem PLUGGY entra na Fase 4)
// ---------------------------------------------------------------------------

export const contaBancariaTipoSchema = z.enum(["CORRENTE", "POUPANCA", "CAIXA", "CARTAO_CREDITO"]);

export const criarContaBancariaManualSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  tipo: contaBancariaTipoSchema,
  saldoInicial: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "Use um número decimal com até 2 casas, ex.: 1500.00")
    .default("0"),
});
export type CriarContaBancariaManualInput = z.infer<typeof criarContaBancariaManualSchema>;

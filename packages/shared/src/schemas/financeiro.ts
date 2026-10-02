import { z } from "zod";
import { valorMonetarioPositivoSchema, valorMonetarioSchema } from "./money";

export const tituloTipoSchema = z.enum(["PAGAR", "RECEBER"]);

// "YYYY-MM-DD" — datas de negócio sem hora; o banco guarda em UTC e a
// apresentação converte para America/Sao_Paulo.
const dataSchema = z.string().date();

export const criarTituloSchema = z
  .object({
    tipo: tituloTipoSchema,
    descricao: z.string().trim().min(2).max(200),
    valorOriginal: valorMonetarioPositivoSchema,
    categoriaId: z.string().uuid(),
    centroCustoId: z.string().uuid().optional(),
    clienteFornecedorId: z.string().uuid().optional(),
    contaBancariaPrevistaId: z.string().uuid().optional(),
    dataEmissao: dataSchema,
    dataVencimento: dataSchema,
  })
  .refine((titulo) => titulo.dataVencimento >= titulo.dataEmissao, {
    message: "O vencimento não pode ser anterior à emissão.",
    path: ["dataVencimento"],
  });
export type CriarTituloInput = z.infer<typeof criarTituloSchema>;

// Campos editáveis. Quais deles ficam travados depois da primeira baixa
// (valorOriginal e dataVencimento) é regra de negócio aplicada no service,
// não deste schema.
export const atualizarTituloSchema = z
  .object({
    descricao: z.string().trim().min(2).max(200).optional(),
    valorOriginal: valorMonetarioPositivoSchema.optional(),
    dataVencimento: dataSchema.optional(),
    categoriaId: z.string().uuid().optional(),
    centroCustoId: z.string().uuid().optional(),
    clienteFornecedorId: z.string().uuid().optional(),
  })
  .refine((dados) => Object.values(dados).some((valor) => valor !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  });
export type AtualizarTituloInput = z.infer<typeof atualizarTituloSchema>;

export const registrarBaixaSchema = z.object({
  valorPago: valorMonetarioPositivoSchema,
  juros: valorMonetarioSchema.default("0"),
  multa: valorMonetarioSchema.default("0"),
  desconto: valorMonetarioSchema.default("0"),
  data: dataSchema,
  contaBancariaId: z.string().uuid(),
});
export type RegistrarBaixaInput = z.infer<typeof registrarBaixaSchema>;

export const solicitarEstornoSchema = z.object({
  motivo: z.string().trim().min(5).max(500),
});
export type SolicitarEstornoInput = z.infer<typeof solicitarEstornoSchema>;

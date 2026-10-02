import { z } from "zod";

// Dinheiro trafega sempre como string decimal (nunca number/float) — a
// conversão para Decimal acontece no domínio (decimal.js) e no banco
// (NUMERIC). Até 2 casas, sem separador de milhar.
const FORMATO_MONETARIO = /^\d+(\.\d{1,2})?$/;
const MENSAGEM = "Use um número decimal com até 2 casas, ex.: 1500.00";

// Aceita zero (ex.: juros/multa/desconto opcionais).
export const valorMonetarioSchema = z.string().regex(FORMATO_MONETARIO, MENSAGEM);

// Exige maior que zero (ex.: valor de um título ou de uma baixa).
export const valorMonetarioPositivoSchema = valorMonetarioSchema.refine(
  (valor) => Number(valor) > 0,
  "O valor deve ser maior que zero.",
);

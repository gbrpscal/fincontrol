import { z } from "zod";

// Fonte de verdade da validação de auth — NestJS (via nestjs-zod) e os apps
// cliente (web/mobile) importam os mesmos schemas, em vez de duplicar regras.

export const registrarSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  senha: z.string().min(8).max(72), // 72 = limite do bcrypt
  empresaNome: z.string().min(2).max(160),
  empresaDocumento: z.string().min(11).max(18), // CPF ou CNPJ, sem formatação validada aqui
});
export type RegistrarInput = z.infer<typeof registrarSchema>;

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  senha: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Segundo passo do login quando o usuário tem mais de uma empresa (membership).
export const loginComEmpresaSchema = loginSchema.extend({
  empresaId: z.string().uuid(),
});
export type LoginComEmpresaInput = z.infer<typeof loginComEmpresaSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const empresaResumoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  role: z.enum(["OWNER", "FINANCEIRO", "ANALISTA"]),
});

// Resposta de login quando há mais de uma empresa: sem tokens ainda, só a
// lista pra o cliente montar a tela de seleção.
export const loginRequerSelecaoSchema = z.object({
  requerSelecaoEmpresa: z.literal(true),
  empresas: z.array(empresaResumoSchema),
});

export const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  empresa: empresaResumoSchema,
});
export type Tokens = z.infer<typeof tokensSchema>;

export const sessaoSchema = z.object({
  id: z.string().uuid(),
  deviceLabel: z.string(),
  ip: z.string().nullable(),
  empresaNome: z.string(),
  criadoEm: z.string().datetime(),
  expiraEm: z.string().datetime(),
  atual: z.boolean(),
});
export type Sessao = z.infer<typeof sessaoSchema>;

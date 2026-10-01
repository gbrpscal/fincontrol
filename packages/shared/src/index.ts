import { z } from "zod";

// Placeholder da Fase 0: prova que apps/api consegue importar de
// @fincontrol/shared através do pipeline do Turborepo (shared precisa
// buildar antes de api, via `dependsOn: ["^build"]` no turbo.json).
// Os schemas de domínio reais (empresa, usuário, títulos...) entram aqui a
// partir da Fase 1.
export const healthResponseSchema = z.object({
  status: z.enum(["ok", "error"]),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export * from "./schemas/auth";
export * from "./schemas/cadastros";

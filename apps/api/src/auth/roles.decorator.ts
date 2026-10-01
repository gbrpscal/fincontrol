import { SetMetadata } from "@nestjs/common";
import type { MembershipRole } from "@prisma/client";

export const ROLES_KEY = "roles";

// Uso: @Roles("OWNER", "FINANCEIRO") em uma rota protegida por JwtAuthGuard +
// RolesGuard. Papéis fixos (decisão confirmada) — sem permissões customizadas
// por usuário nesta fase.
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);

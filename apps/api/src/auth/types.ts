import type { MembershipRole } from "@prisma/client";

// Claims do access token — carregam o contexto de tenant (empresa/papel
// ativos) usado pelo TenantPrismaService pra aplicar RLS.
export interface AccessTokenPayload {
  sub: string; // userId
  membershipId: string;
  empresaId: string;
  role: MembershipRole;
  sessionId: string; // RefreshSession que originou este access token — usado pra marcar "sessão atual" na listagem
}

// O que fica disponível em `request.user` depois do JwtAuthGuard.
export type AuthenticatedUser = AccessTokenPayload;

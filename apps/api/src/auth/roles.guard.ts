import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { MembershipRole } from "@prisma/client";
import { ROLES_KEY } from "./roles.decorator";
import type { AuthenticatedUser } from "./types";

// Sempre usado depois de JwtAuthGuard (precisa de request.user já
// preenchido). Sem @Roles() na rota, libera qualquer papel autenticado.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("Seu papel na empresa não tem permissão para esta ação.");
    }

    return true;
  }
}

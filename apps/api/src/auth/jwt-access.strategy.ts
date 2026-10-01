import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AccessTokenPayload, AuthenticatedUser } from "./types";

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  // O retorno vira `request.user` — já no formato que o resto da aplicação
  // (TenantPrismaService, RolesGuard) espera.
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return payload;
  }
}

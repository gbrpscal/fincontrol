import { randomBytes, createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AccessTokenPayload } from "./types";

const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_DIAS = 30;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }

  // Refresh token é opaco (não-JWT) de propósito: não precisa ser
  // autocontido, só existe pra ser trocado por um novo access token, então
  // um identificador aleatório de alta entropia + lookup por hash no banco é
  // mais simples e mais fácil de revogar do que gerenciar um segundo JWT.
  generateRefreshToken(): { token: string; hash: string; expiraEm: Date } {
    const token = randomBytes(48).toString("base64url");
    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + REFRESH_TOKEN_TTL_DIAS);
    return { token, hash: this.hashRefreshToken(token), expiraEm };
  }

  // SHA-256 (determinístico) em vez de bcrypt: precisamos de
  // `WHERE refreshTokenHash = ?` indexado. bcrypt é pra senha (baixa
  // entropia, precisa de custo computacional contra força bruta); um token
  // aleatório de 48 bytes já tem entropia suficiente pra um hash rápido ser
  // seguro aqui.
  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

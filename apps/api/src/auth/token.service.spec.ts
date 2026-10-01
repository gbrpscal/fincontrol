import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { TokenService } from "./token.service";

describe("TokenService", () => {
  let service: TokenService;

  beforeAll(() => {
    const config = { getOrThrow: () => "test-secret" } as unknown as ConfigService;
    service = new TokenService(new JwtService(), config);
  });

  it("assina e verifica um access token com o payload correto", () => {
    const token = service.signAccessToken({
      sub: "user-1",
      membershipId: "membership-1",
      empresaId: "empresa-1",
      role: "OWNER",
      sessionId: "session-1",
    });

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
  });

  it("gera refresh tokens diferentes a cada chamada, com hash determinístico", () => {
    const first = service.generateRefreshToken();
    const second = service.generateRefreshToken();

    expect(first.token).not.toBe(second.token);
    expect(first.hash).not.toBe(second.hash);

    // determinístico: o mesmo token sempre produz o mesmo hash (precisa pra
    // dar lookup por hash no banco).
    expect(service.hashRefreshToken(first.token)).toBe(first.hash);
    expect(service.hashRefreshToken(first.token)).toBe(service.hashRefreshToken(first.token));
  });

  it("expira o refresh token 30 dias no futuro", () => {
    const before = Date.now();
    const { expiraEm } = service.generateRefreshToken();
    const diffDias = (expiraEm.getTime() - before) / (1000 * 60 * 60 * 24);

    expect(diffDias).toBeGreaterThan(29.9);
    expect(diffDias).toBeLessThan(30.1);
  });
});

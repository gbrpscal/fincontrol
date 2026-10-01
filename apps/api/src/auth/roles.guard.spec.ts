import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import type { AuthenticatedUser } from "./types";

function contextComUsuario(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

const usuarioAnalista: AuthenticatedUser = {
  sub: "u1",
  membershipId: "m1",
  empresaId: "e1",
  role: "ANALISTA",
  sessionId: "s1",
};

describe("RolesGuard", () => {
  it("libera quando a rota não declara @Roles()", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextComUsuario(usuarioAnalista))).toBe(true);
  });

  it("libera quando o papel do usuário está entre os exigidos", () => {
    const reflector = { getAllAndOverride: () => ["ANALISTA", "OWNER"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextComUsuario(usuarioAnalista))).toBe(true);
  });

  it("rejeita quando o papel do usuário não está entre os exigidos", () => {
    const reflector = { getAllAndOverride: () => ["OWNER", "FINANCEIRO"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextComUsuario(usuarioAnalista))).toThrow(ForbiddenException);
  });

  it("rejeita quando não há usuário autenticado no request", () => {
    const reflector = { getAllAndOverride: () => ["OWNER"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextComUsuario(undefined))).toThrow(ForbiddenException);
  });
});

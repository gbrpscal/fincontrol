import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { HealthCheckService } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { PrismaHealthIndicator } from "./prisma-health.indicator";
import { RedisHealthIndicator } from "./redis-health.indicator";

// Unitário (com mocks) — verifica a fiação do controller sem depender de
// Postgres/Redis reais. O teste com banco/Redis de verdade é o e2e
// (test/health.e2e-spec.ts), que valida o comportamento fim a fim.
describe("HealthController", () => {
  it("consulta os indicadores de postgres e redis com a REDIS_URL do config", async () => {
    const checkResult = { status: "ok", info: {}, error: {}, details: {} };
    const health = { check: jest.fn().mockResolvedValue(checkResult) };
    const prismaIndicator = { pingCheck: jest.fn() };
    const redisIndicator = { pingCheck: jest.fn() };
    const config = { get: jest.fn().mockReturnValue("redis://redis:6379") };

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    })
      .useMocker((token) => {
        if (token === HealthCheckService) return health;
        if (token === PrismaHealthIndicator) return prismaIndicator;
        if (token === RedisHealthIndicator) return redisIndicator;
        if (token === ConfigService) return config;
        return undefined;
      })
      .compile();

    const controller = moduleRef.get(HealthController);
    const result = await controller.check();

    expect(result).toBe(checkResult);
    expect(config.get).toHaveBeenCalledWith("REDIS_URL", "redis://localhost:6379");

    // As duas funções passadas para health.check() precisam de fato chamar
    // os indicadores certos — health.check() só recebe as closures, quem
    // executa é o Terminus, então validamos invocando-as aqui.
    const [[postgresCheck, redisCheck]] = health.check.mock.calls[0] as [
      [() => unknown, () => unknown],
    ];

    await postgresCheck();
    expect(prismaIndicator.pingCheck).toHaveBeenCalledWith("postgres");

    await redisCheck();
    expect(redisIndicator.pingCheck).toHaveBeenCalledWith("redis", "redis://redis:6379");
  });
});

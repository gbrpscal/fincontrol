import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { PrismaHealthIndicator } from "./prisma-health.indicator";
import { RedisHealthIndicator } from "./redis-health.indicator";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const redisUrl = this.config.get<string>("REDIS_URL", "redis://localhost:6379");
    return this.health.check([
      () => this.prismaIndicator.pingCheck("postgres"),
      () => this.redisIndicator.pingCheck("redis", redisUrl),
    ]);
  }
}

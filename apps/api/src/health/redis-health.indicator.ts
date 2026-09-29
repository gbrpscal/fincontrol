import { Injectable } from "@nestjs/common";
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from "@nestjs/terminus";
import Redis from "ioredis";

// Terminus não vem com um indicador de Redis pronto (só Postgres/Mongo via
// TypeORM/Mongoose, HTTP, disco e memória) — este é escrito à mão, seguindo o
// mesmo contrato dos indicadores nativos.
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  async pingCheck(key: string, redisUrl: string): Promise<HealthIndicatorResult> {
    const client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await client.connect();
      await client.ping();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    } finally {
      client.disconnect();
    }
  }
}

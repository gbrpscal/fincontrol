import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    // APP_DATABASE_URL (não DATABASE_URL, que é só do Prisma CLI pra
    // migrate/generate): o runtime da aplicação conecta com uma role sem
    // BYPASSRLS, senão o Row-Level Security não vale nada de verdade — RLS
    // nunca se aplica a superusuário, nem com FORCE ROW LEVEL SECURITY. Ver
    // prisma/migrations/20260930234235_create_app_role.
    super({
      datasources: { db: { url: config.getOrThrow<string>("APP_DATABASE_URL") } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

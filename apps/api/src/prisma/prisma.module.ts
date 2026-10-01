import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { TenantPrismaService } from "./tenant-prisma.service";

// @Global(): PrismaService/TenantPrismaService são usados por praticamente
// todo módulo de domínio; declarar global evita reimportar PrismaModule em
// cada um deles.
@Global()
@Module({
  providers: [PrismaService, TenantPrismaService],
  exports: [PrismaService, TenantPrismaService],
})
export class PrismaModule {}

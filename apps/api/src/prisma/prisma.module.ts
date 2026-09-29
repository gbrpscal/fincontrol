import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

// @Global(): PrismaService é usado por praticamente todo módulo de domínio;
// declarar global evita reimportar PrismaModule em cada um deles.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

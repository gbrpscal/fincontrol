import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validação global via Zod (nestjs-zod) — os schemas em
  // @fincontrol/shared são a única fonte de verdade, reaproveitada pelos
  // DTOs daqui e futuramente pelos apps cliente.
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();

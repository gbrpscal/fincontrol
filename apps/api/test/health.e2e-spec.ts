import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

// Sobe o módulo inteiro e bate no endpoint de verdade contra Postgres/Redis
// reais (DATABASE_URL / REDIS_URL do ambiente) — não é um teste com mocks.
// Roda via `docker compose run --rm api pnpm test:e2e` (Postgres/Redis já de
// pé pelo compose) ou no CI (serviços do GitHub Actions).
describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health retorna 200 com Postgres e Redis ok", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.info.postgres.status).toBe("up");
    expect(response.body.info.redis.status).toBe("up");
  });
});

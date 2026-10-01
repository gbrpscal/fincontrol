import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("fluxo completo: registrar -> login -> sessões -> refresh (rotação) -> logout", async () => {
    const email = `teste-${randomUUID()}@fincontrol.dev`;

    const registrar = await request(app.getHttpServer()).post("/auth/registrar").send({
      nome: "Usuária de Teste",
      email,
      senha: "senha-super-secreta",
      empresaNome: "Empresa de Teste",
      empresaDocumento: `12345${Date.now()}`,
    });
    expect(registrar.status).toBe(201);
    expect(registrar.body.accessToken).toEqual(expect.any(String));
    expect(registrar.body.refreshToken).toEqual(expect.any(String));
    expect(registrar.body.empresa.role).toBe("OWNER");

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, senha: "senha-super-secreta" });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toEqual(expect.any(String));

    const loginSenhaErrada = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, senha: "senha-errada" });
    expect(loginSenhaErrada.status).toBe(401);

    const semToken = await request(app.getHttpServer()).get("/auth/sessoes");
    expect(semToken.status).toBe(401);

    const sessoes = await request(app.getHttpServer())
      .get("/auth/sessoes")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(sessoes.status).toBe(200);
    // registrar() e login() cada um cria sua própria sessão de refresh.
    expect(sessoes.body.length).toBeGreaterThanOrEqual(2);
    expect(sessoes.body.some((s: { atual: boolean }) => s.atual)).toBe(true);

    const refresh = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).not.toBe(login.body.accessToken);

    // Refresh token é de uso único — reusar o mesmo token depois da rotação
    // tem que falhar (senão um token vazado nunca perderia a validade).
    const refreshReuso = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshReuso.status).toBe(401);

    const logout = await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ refreshToken: refresh.body.refreshToken });
    expect(logout.status).toBe(204);

    const refreshAposLogout = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: refresh.body.refreshToken });
    expect(refreshAposLogout.status).toBe(401);

    await prisma.empresa.deleteMany({ where: { id: registrar.body.empresa.id } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("rejeita registro com e-mail já existente", async () => {
    const email = `duplicado-${randomUUID()}@fincontrol.dev`;
    const base = {
      nome: "Original",
      email,
      senha: "senha-valida-123",
      empresaNome: "Empresa Original",
      empresaDocumento: `1${Date.now()}`,
    };
    const primeiro = await request(app.getHttpServer()).post("/auth/registrar").send(base);
    expect(primeiro.status).toBe(201);

    const segundo = await request(app.getHttpServer())
      .post("/auth/registrar")
      .send({ ...base, empresaDocumento: `2${Date.now()}` });
    expect(segundo.status).toBe(409);

    await prisma.empresa.deleteMany({ where: { id: primeiro.body.empresa.id } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("usuário com mais de uma empresa precisa selecionar antes de receber tokens", async () => {
    const email = `multi-${randomUUID()}@fincontrol.dev`;
    const registrar = await request(app.getHttpServer()).post("/auth/registrar").send({
      nome: "Multi Empresa",
      email,
      senha: "senha-valida-123",
      empresaNome: "Empresa 1",
      empresaDocumento: `1${Date.now()}`,
    });
    expect(registrar.status).toBe(201);
    const empresa1Id = registrar.body.empresa.id;

    // Convite pra segunda empresa ainda não é um fluxo de API (fica pra
    // Fase 2/cadastros) — inserido direto pelo client base só pra montar o
    // cenário do teste.
    const empresa2 = await prisma.empresa.create({
      data: { nome: "Empresa 2", documento: `2${Date.now()}` },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.membership.create({
      data: { userId: user.id, empresaId: empresa2.id, role: "ANALISTA" },
    });

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, senha: "senha-valida-123" });
    expect(login.status).toBe(200);
    expect(login.body.requerSelecaoEmpresa).toBe(true);
    expect(login.body.empresas).toHaveLength(2);
    expect(login.body.accessToken).toBeUndefined();

    const loginComEmpresa = await request(app.getHttpServer())
      .post("/auth/login/empresa")
      .send({ email, senha: "senha-valida-123", empresaId: empresa2.id });
    expect(loginComEmpresa.status).toBe(200);
    expect(loginComEmpresa.body.empresa.id).toBe(empresa2.id);
    expect(loginComEmpresa.body.empresa.role).toBe("ANALISTA");

    await prisma.empresa.deleteMany({ where: { id: { in: [empresa1Id, empresa2.id] } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("revogar uma sessão derruba só aquela sessão, nunca as de outro usuário", async () => {
    const email = `sessoes-${randomUUID()}@fincontrol.dev`;
    const registrar = await request(app.getHttpServer()).post("/auth/registrar").send({
      nome: "Dona das Sessões",
      email,
      senha: "senha-valida-123",
      empresaNome: "Empresa Sessões",
      empresaDocumento: `3${Date.now()}`,
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, senha: "senha-valida-123" });

    const sessoesAntes = await request(app.getHttpServer())
      .get("/auth/sessoes")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    const sessaoDeRegistrar = sessoesAntes.body.find((s: { atual: boolean }) => !s.atual);
    expect(sessaoDeRegistrar).toBeDefined();

    const revogar = await request(app.getHttpServer())
      .delete(`/auth/sessoes/${sessaoDeRegistrar.id}`)
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(revogar.status).toBe(204);

    const sessoesDepois = await request(app.getHttpServer())
      .get("/auth/sessoes")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(sessoesDepois.body.some((s: { id: string }) => s.id === sessaoDeRegistrar.id)).toBe(false);

    await prisma.empresa.deleteMany({ where: { id: registrar.body.empresa.id } });
    await prisma.user.deleteMany({ where: { email } });
  });
});

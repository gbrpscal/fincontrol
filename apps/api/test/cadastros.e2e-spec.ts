import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

async function registrarEmpresa(app: INestApplication, nomeEmpresa: string) {
  const email = `cadastros-${randomUUID()}@fincontrol.dev`;
  const res = await request(app.getHttpServer()).post("/auth/registrar").send({
    nome: "Dona da Empresa",
    email,
    senha: "senha-valida-123",
    empresaNome: nomeEmpresa,
    empresaDocumento: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  return { email, accessToken: res.body.accessToken as string, empresaId: res.body.empresa.id as string };
}

describe("Cadastros (e2e)", () => {
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

  it("uma empresa nova já nasce com o plano de contas padrão copiado do template", async () => {
    const { accessToken, empresaId } = await registrarEmpresa(app, "Empresa Plano Padrão");

    const res = await request(app.getHttpServer())
      .get("/categorias")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    // 25 é o tamanho do template seedado em prisma/seed.ts — se esse número
    // mudar, o seed mudou, não é um valor arbitrário.
    expect(res.body.length).toBe(25);
    expect(res.body.some((c: { nome: string; tipo: string }) => c.nome === "Aluguel" && c.tipo === "DESPESA")).toBe(
      true,
    );
    const raizReceitas = res.body.find((c: { nome: string }) => c.nome === "Receitas");
    expect(raizReceitas.parentId).toBeNull();
    const vendas = res.body.find((c: { nome: string }) => c.nome === "Vendas de Produtos");
    expect(vendas.parentId).toBe(raizReceitas.id);

    await prisma.empresa.delete({ where: { id: empresaId } });
  });

  it("cria uma subcategoria customizada sob uma categoria do template", async () => {
    const { accessToken, empresaId } = await registrarEmpresa(app, "Empresa Categoria Custom");

    const categorias = await request(app.getHttpServer())
      .get("/categorias")
      .set("Authorization", `Bearer ${accessToken}`);
    const marketing = categorias.body.find((c: { nome: string }) => c.nome === "Marketing e Publicidade");

    const criar = await request(app.getHttpServer())
      .post("/categorias")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nome: "Anúncios no Instagram", tipo: "DESPESA", parentId: marketing.id });

    expect(criar.status).toBe(201);
    expect(criar.body.parentId).toBe(marketing.id);
    expect(criar.body.origemTemplateId).toBeNull();

    await prisma.categoria.deleteMany({ where: { empresaId } });
    await prisma.empresa.delete({ where: { id: empresaId } });
  });

  it("rejeita criar categoria com parentId de outra empresa (RLS bloqueando o que a FK sozinha não bloquearia)", async () => {
    const empresaA = await registrarEmpresa(app, "Empresa A (parentId cruzado)");
    const empresaB = await registrarEmpresa(app, "Empresa B (parentId cruzado)");

    const categoriasB = await request(app.getHttpServer())
      .get("/categorias")
      .set("Authorization", `Bearer ${empresaB.accessToken}`);
    const categoriaDeB = categoriasB.body[0];

    const tentativa = await request(app.getHttpServer())
      .post("/categorias")
      .set("Authorization", `Bearer ${empresaA.accessToken}`)
      .send({ nome: "Vazamento", tipo: "DESPESA", parentId: categoriaDeB.id });

    expect(tentativa.status).toBe(404);

    await prisma.empresa.delete({ where: { id: empresaA.empresaId } });
    await prisma.empresa.delete({ where: { id: empresaB.empresaId } });
  });

  it("um papel ANALISTA consegue listar cadastros mas não criar (RBAC de verdade, não só o guard)", async () => {
    const dona = await registrarEmpresa(app, "Empresa RBAC Cadastros");

    const emailAnalista = `analista-${randomUUID()}@fincontrol.dev`;

    // Cria o segundo usuário com a senha hasheada pelo serviço real (não
    // reimplementa bcrypt aqui), e um membership ANALISTA na mesma empresa —
    // convite ainda não é fluxo de API (fica pra Fase 2+/backlog).
    const { PasswordService } = await import("../src/auth/password.service");
    const hash = await new PasswordService().hash("senha-analista-123");
    const userAnalista = await prisma.user.create({
      data: { nome: "Usuária Analista", email: emailAnalista, senhaHash: hash },
    });
    await prisma.membership.create({
      data: { userId: userAnalista.id, empresaId: dona.empresaId, role: "ANALISTA" },
    });

    const loginAnalista = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: emailAnalista, senha: "senha-analista-123" });
    expect(loginAnalista.status).toBe(200);
    const tokenAnalista = loginAnalista.body.accessToken as string;

    const listar = await request(app.getHttpServer())
      .get("/categorias")
      .set("Authorization", `Bearer ${tokenAnalista}`);
    expect(listar.status).toBe(200);

    const criar = await request(app.getHttpServer())
      .post("/categorias")
      .set("Authorization", `Bearer ${tokenAnalista}`)
      .send({ nome: "Categoria Proibida", tipo: "DESPESA" });
    expect(criar.status).toBe(403);

    await prisma.membership.deleteMany({ where: { userId: userAnalista.id } });
    await prisma.user.delete({ where: { id: userAnalista.id } });
    await prisma.empresa.delete({ where: { id: dona.empresaId } });
  });

  it("centro de custo, cliente/fornecedor e conta bancária: criar e listar funcionam e ficam isolados por empresa", async () => {
    const empresaA = await registrarEmpresa(app, "Empresa A (cadastros gerais)");
    const empresaB = await registrarEmpresa(app, "Empresa B (cadastros gerais)");

    const centroCusto = await request(app.getHttpServer())
      .post("/centros-custo")
      .set("Authorization", `Bearer ${empresaA.accessToken}`)
      .send({ nome: "Filial Centro" });
    expect(centroCusto.status).toBe(201);

    const cliente = await request(app.getHttpServer())
      .post("/clientes-fornecedores")
      .set("Authorization", `Bearer ${empresaA.accessToken}`)
      .send({ nome: "Cliente Importante", tipo: "CLIENTE", documento: "12345678901" });
    expect(cliente.status).toBe(201);
    expect(cliente.body.documento).toBe("12345678901");

    const conta = await request(app.getHttpServer())
      .post("/contas-bancarias")
      .set("Authorization", `Bearer ${empresaA.accessToken}`)
      .send({ nome: "Conta Corrente Principal", tipo: "CORRENTE", saldoInicial: "2500.75" });
    expect(conta.status).toBe(201);
    expect(conta.body.saldoAtual).toBe("2500.75");

    // Empresa B não vê nada do que a empresa A acabou de criar.
    const listaCentroCustoB = await request(app.getHttpServer())
      .get("/centros-custo")
      .set("Authorization", `Bearer ${empresaB.accessToken}`);
    expect(listaCentroCustoB.body).toHaveLength(0);

    const listaClientesB = await request(app.getHttpServer())
      .get("/clientes-fornecedores")
      .set("Authorization", `Bearer ${empresaB.accessToken}`);
    expect(listaClientesB.body).toHaveLength(0);

    const listaContasB = await request(app.getHttpServer())
      .get("/contas-bancarias")
      .set("Authorization", `Bearer ${empresaB.accessToken}`);
    expect(listaContasB.body).toHaveLength(0);

    await prisma.centroCusto.deleteMany({ where: { empresaId: empresaA.empresaId } });
    await prisma.clienteFornecedor.deleteMany({ where: { empresaId: empresaA.empresaId } });
    await prisma.contaBancaria.deleteMany({ where: { empresaId: empresaA.empresaId } });
    await prisma.empresa.delete({ where: { id: empresaA.empresaId } });
    await prisma.empresa.delete({ where: { id: empresaB.empresaId } });
  });
});

import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import type { MembershipRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PasswordService } from "../src/auth/password.service";
import { PrismaService } from "../src/prisma/prisma.service";

export const SENHA = "senha-valida-123";

export interface EmpresaDeTeste {
  empresaId: string;
  userId: string;
  email: string;
  accessToken: string;
}

export async function criarApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
  // Testes de concorrência abrem dezenas de requisições no mesmo servidor.
  app.getHttpServer().setMaxListeners(100);
  return { app, prisma: moduleRef.get(PrismaService) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function registrarEmpresa(
  app: INestApplication,
  prisma: PrismaService,
  nomeEmpresa: string,
): Promise<EmpresaDeTeste> {
  const email = `teste-${randomUUID()}@fincontrol.dev`;
  const res = await request(app.getHttpServer())
    .post("/auth/registrar")
    .send({
      nome: "Dona da Empresa",
      email,
      senha: SENHA,
      empresaNome: nomeEmpresa,
      empresaDocumento: `${Date.now()}${Math.floor(Math.random() * 100000)}`,
    });
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { empresaId: res.body.empresa.id, userId: user.id, email, accessToken: res.body.accessToken };
}

// Segundo usuário na mesma empresa, com o papel pedido (convite ainda não é
// fluxo de API). Faz login de verdade pra obter um token real.
export async function adicionarMembro(
  app: INestApplication,
  prisma: PrismaService,
  empresaId: string,
  role: MembershipRole,
): Promise<EmpresaDeTeste> {
  const email = `membro-${randomUUID()}@fincontrol.dev`;
  const user = await prisma.user.create({
    data: { nome: `Membro ${role}`, email, senhaHash: await new PasswordService().hash(SENHA) },
  });
  await prisma.membership.create({ data: { userId: user.id, empresaId, role } });
  const login = await request(app.getHttpServer()).post("/auth/login").send({ email, senha: SENHA });
  return { empresaId, userId: user.id, email, accessToken: login.body.accessToken };
}

export async function categoriaPorNome(app: INestApplication, token: string, nome: string): Promise<string> {
  const res = await request(app.getHttpServer()).get("/categorias").set(bearer(token));
  return res.body.find((c: { nome: string }) => c.nome === nome).id;
}

export async function criarConta(
  app: INestApplication,
  token: string,
  saldoInicial = "1000.00",
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/contas-bancarias")
    .set(bearer(token))
    .send({ nome: `Conta ${randomUUID().slice(0, 6)}`, tipo: "CORRENTE", saldoInicial });
  return res.body.id;
}

export async function criarTitulo(
  app: INestApplication,
  token: string,
  categoriaId: string,
  extra: Record<string, unknown> = {},
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post("/titulos")
    .set(bearer(token))
    .send({
      tipo: "PAGAR",
      descricao: "Título de teste",
      valorOriginal: "1000.00",
      categoriaId,
      dataEmissao: "2026-10-01",
      dataVencimento: "2026-10-20",
      ...extra,
    });
}

// Lê auditoria com o contexto de tenant da empresa (RLS), como a app faria.
export async function auditoriaDe(prisma: PrismaService, empresaId: string, entidadeId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_empresa_id', ${empresaId}, true)`;
    return tx.auditLog.findMany({ where: { entidadeId }, orderBy: { createdAt: "asc" } });
  });
}

// Limpeza na ordem das FKs (Restrict em categoria/conta ↔ título), sob o
// contexto de tenant da empresa — depois remove a empresa e os usuários.
export async function limparEmpresa(
  prisma: PrismaService,
  empresaId: string,
  emails: string[] = [],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_empresa_id', ${empresaId}, true)`;
    await tx.estornoSolicitacao.deleteMany({});
    await tx.baixa.deleteMany({});
    await tx.anexo.deleteMany({});
    await tx.titulo.deleteMany({});
    await tx.auditLog.deleteMany({});
    await tx.contaBancaria.deleteMany({});
    await tx.clienteFornecedor.deleteMany({});
    await tx.centroCusto.deleteMany({});
    await tx.categoria.deleteMany({ where: { parentId: { not: null } } });
    await tx.categoria.deleteMany({});
  });
  await prisma.empresa.delete({ where: { id: empresaId } });
  if (emails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  }
}

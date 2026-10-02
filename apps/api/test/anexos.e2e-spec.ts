import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  EmpresaDeTeste,
  adicionarMembro,
  bearer,
  categoriaPorNome,
  criarApp,
  criarTitulo,
  limparEmpresa,
  registrarEmpresa,
} from "./helpers";

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("conteúdo do boleto", "utf8"), Buffer.alloc(64, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 9)]);

describe("Anexos (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let raizStorage: string;
  const empresas: EmpresaDeTeste[] = [];
  const emails: string[] = [];

  async function cenario(nome: string) {
    const e = await registrarEmpresa(app, prisma, nome);
    empresas.push(e);
    emails.push(e.email);
    const categoriaId = await categoriaPorNome(app, e.accessToken, "Aluguel");
    const titulo = (await criarTitulo(app, e.accessToken, categoriaId)).body;
    return { e, titulo };
  }

  const enviar = (token: string, tituloId: string, conteudo: Buffer, filename: string, contentType: string) =>
    request(app.getHttpServer())
      .post(`/titulos/${tituloId}/anexos`)
      .set(bearer(token))
      .attach("arquivo", conteudo, { filename, contentType });

  // Chave interna do storage — não sai pela API, então lê direto do banco
  // (com o contexto de tenant, como a aplicação faria).
  async function chaveNoStorage(empresaId: string, anexoId: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_empresa_id', ${empresaId}, true)`;
      return (await tx.anexo.findUniqueOrThrow({ where: { id: anexoId } })).url;
    });
  }

  beforeAll(async () => {
    raizStorage = await mkdtemp(join(tmpdir(), "fincontrol-anexos-e2e-"));
    process.env.ANEXOS_DIR = raizStorage;
    ({ app, prisma } = await criarApp());
  });

  afterAll(async () => {
    for (const e of empresas) await limparEmpresa(prisma, e.empresaId, emails);
    await app.close();
    await rm(raizStorage, { recursive: true, force: true });
  });

  it("envia um PDF e baixa de volta exatamente os mesmos bytes, com headers de download seguros", async () => {
    const { e, titulo } = await cenario("Anexos Roundtrip");

    const res = await enviar(e.accessToken, titulo.id, PDF, "Boleto Outubro.pdf", "application/pdf");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tituloId: titulo.id,
      nomeArquivo: "Boleto Outubro.pdf",
      tipoMime: "application/pdf",
      tamanhoBytes: PDF.length,
      enviadoPor: e.userId,
    });
    expect(res.body.url).toBeUndefined();

    const download = await request(app.getHttpServer())
      .get(`/anexos/${res.body.id}/download`)
      .set(bearer(e.accessToken))
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on("data", (p: Buffer) => partes.push(p));
        r.on("end", () => cb(null, Buffer.concat(partes)));
      });
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toMatch(/^attachment; filename\*=UTF-8''Boleto%20Outubro\.pdf$/);
    expect((download.body as Buffer).equals(PDF)).toBe(true);

    const lista = await request(app.getHttpServer()).get(`/titulos/${titulo.id}/anexos`).set(bearer(e.accessToken));
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].url).toBeUndefined();

    const trilha = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_empresa_id', ${e.empresaId}, true)`;
      return tx.auditLog.findMany({ where: { entidade: "Anexo", entidadeId: res.body.id } });
    });
    expect(trilha).toHaveLength(1);
    expect(trilha[0]?.userId).toBe(e.userId);
  });

  it("aceita PNG, e a chave no storage nunca contém o nome enviado pelo cliente", async () => {
    const { e, titulo } = await cenario("Anexos Chave");

    const res = await enviar(e.accessToken, titulo.id, PNG, "../../../etc/passwd.png", "image/png");

    expect(res.status).toBe(201);
    expect(res.body.nomeArquivo).toBe("passwd.png");
    const chave = await chaveNoStorage(e.empresaId, res.body.id);
    expect(chave.startsWith(`${e.empresaId}/${titulo.id}/`)).toBe(true);
    expect(chave).not.toContain("passwd");
    expect(chave).not.toContain("..");
    expect(chave.endsWith(".png")).toBe(true);
    expect(existsSync(join(raizStorage, chave))).toBe(true);
  });

  it("recusa tipo não permitido (415), conteúdo que não bate com o tipo declarado (415) e arquivo faltando (400)", async () => {
    const { e, titulo } = await cenario("Anexos Validação");

    const texto = await enviar(e.accessToken, titulo.id, Buffer.from("olá"), "x.txt", "text/plain");
    expect(texto.status).toBe(415);

    const executavelDisfarcado = await enviar(
      e.accessToken,
      titulo.id,
      Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)]),
      "boleto.pdf",
      "application/pdf",
    );
    expect(executavelDisfarcado.status).toBe(415);

    const pngComoPdf = await enviar(e.accessToken, titulo.id, PNG, "foto.pdf", "application/pdf");
    expect(pngComoPdf.status).toBe(415);

    const semArquivo = await request(app.getHttpServer())
      .post(`/titulos/${titulo.id}/anexos`)
      .set(bearer(e.accessToken))
      .field("nada", "aqui");
    expect(semArquivo.status).toBe(400);

    const lista = await request(app.getHttpServer()).get(`/titulos/${titulo.id}/anexos`).set(bearer(e.accessToken));
    expect(lista.body).toHaveLength(0);
  });

  it("recusa arquivo acima de 10 MB (413) sem gravar nada", async () => {
    const { e, titulo } = await cenario("Anexos Tamanho");
    const grande = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(10 * 1024 * 1024)]);

    const res = await enviar(e.accessToken, titulo.id, grande, "enorme.pdf", "application/pdf");

    expect(res.status).toBe(413);
    const lista = await request(app.getHttpServer()).get(`/titulos/${titulo.id}/anexos`).set(bearer(e.accessToken));
    expect(lista.body).toHaveLength(0);
  });

  it("outra empresa não lista, não baixa, não anexa e não remove anexo alheio (404)", async () => {
    const a = await cenario("Anexos Empresa A");
    const b = await cenario("Anexos Empresa B");
    const anexo = (await enviar(a.e.accessToken, a.titulo.id, PDF, "a.pdf", "application/pdf")).body;

    const get = (url: string) => request(app.getHttpServer()).get(url).set(bearer(b.e.accessToken));
    expect((await get(`/titulos/${a.titulo.id}/anexos`)).status).toBe(404);
    expect((await get(`/anexos/${anexo.id}/download`)).status).toBe(404);
    expect((await enviar(b.e.accessToken, a.titulo.id, PDF, "b.pdf", "application/pdf")).status).toBe(404);
    expect(
      (await request(app.getHttpServer()).delete(`/anexos/${anexo.id}`).set(bearer(b.e.accessToken))).status,
    ).toBe(404);

    // O dono continua com o arquivo intacto.
    expect((await request(app.getHttpServer()).get(`/anexos/${anexo.id}/download`).set(bearer(a.e.accessToken))).status).toBe(200);
  });

  it("ANALISTA lista e baixa, mas não envia nem remove (403)", async () => {
    const { e, titulo } = await cenario("Anexos RBAC");
    const anexo = (await enviar(e.accessToken, titulo.id, PDF, "r.pdf", "application/pdf")).body;
    const analista = await adicionarMembro(app, prisma, e.empresaId, "ANALISTA");
    emails.push(analista.email);

    expect((await request(app.getHttpServer()).get(`/titulos/${titulo.id}/anexos`).set(bearer(analista.accessToken))).status).toBe(200);
    expect((await request(app.getHttpServer()).get(`/anexos/${anexo.id}/download`).set(bearer(analista.accessToken))).status).toBe(200);
    expect((await enviar(analista.accessToken, titulo.id, PDF, "n.pdf", "application/pdf")).status).toBe(403);
    expect((await request(app.getHttpServer()).delete(`/anexos/${anexo.id}`).set(bearer(analista.accessToken))).status).toBe(403);
  });

  it("remover apaga o metadado E o arquivo do storage e deixa trilha de auditoria", async () => {
    const { e, titulo } = await cenario("Anexos Remoção");
    const anexo = (await enviar(e.accessToken, titulo.id, PDF, "apagar.pdf", "application/pdf")).body;
    const chave = await chaveNoStorage(e.empresaId, anexo.id);
    expect(existsSync(join(raizStorage, chave))).toBe(true);

    const res = await request(app.getHttpServer()).delete(`/anexos/${anexo.id}`).set(bearer(e.accessToken));

    expect(res.status).toBe(204);
    expect(existsSync(join(raizStorage, chave))).toBe(false);
    expect((await request(app.getHttpServer()).get(`/anexos/${anexo.id}/download`).set(bearer(e.accessToken))).status).toBe(404);

    const trilha = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_empresa_id', ${e.empresaId}, true)`;
      return tx.auditLog.findMany({ where: { entidade: "Anexo", entidadeId: anexo.id }, orderBy: { createdAt: "asc" } });
    });
    expect(trilha.map((t) => t.acao)).toEqual(["CREATE", "DELETE"]);
    expect(trilha[1]?.antes).toMatchObject({ nomeArquivo: "apagar.pdf" });
  });
});

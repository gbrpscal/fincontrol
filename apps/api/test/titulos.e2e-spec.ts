import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  EmpresaDeTeste,
  adicionarMembro,
  auditoriaDe,
  bearer,
  categoriaPorNome,
  criarApp,
  criarTitulo,
  limparEmpresa,
  registrarEmpresa,
} from "./helpers";

describe("Títulos (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const empresas: EmpresaDeTeste[] = [];
  const emails: string[] = [];

  async function novaEmpresa(nome: string) {
    const e = await registrarEmpresa(app, prisma, nome);
    empresas.push(e);
    emails.push(e.email);
    return e;
  }

  beforeAll(async () => {
    ({ app, prisma } = await criarApp());
  });

  afterAll(async () => {
    for (const e of empresas) await limparEmpresa(prisma, e.empresaId, emails);
    await app.close();
  });

  it("cria título com saldo em aberto igual ao valor e registra auditoria com o autor", async () => {
    const e = await novaEmpresa("Empresa Títulos 1");
    const categoriaId = await categoriaPorNome(app, e.accessToken, "Aluguel");

    const res = await criarTitulo(app, e.accessToken, categoriaId, { valorOriginal: "3500.50" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("ABERTO");
    expect(res.body.valorOriginal).toBe("3500.5");
    expect(res.body.saldoAberto).toBe(res.body.valorOriginal);

    const trilha = await auditoriaDe(prisma, e.empresaId, res.body.id);
    expect(trilha).toHaveLength(1);
    expect(trilha[0]?.acao).toBe("CREATE");
    expect(trilha[0]?.userId).toBe(e.userId);
    expect(trilha[0]?.depois).toMatchObject({ valorOriginal: "3500.50", status: "ABERTO" });
  });

  it("rejeita vencimento anterior à emissão com 400 apontando o campo", async () => {
    const e = await novaEmpresa("Empresa Títulos 2");
    const categoriaId = await categoriaPorNome(app, e.accessToken, "Aluguel");

    const res = await criarTitulo(app, e.accessToken, categoriaId, {
      dataEmissao: "2026-10-10",
      dataVencimento: "2026-10-01",
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("dataVencimento");
  });

  it("lista com filtros de tipo, status e faixa de vencimento, ordenada por vencimento", async () => {
    const e = await novaEmpresa("Empresa Títulos 3");
    const despesa = await categoriaPorNome(app, e.accessToken, "Aluguel");
    const receita = await categoriaPorNome(app, e.accessToken, "Vendas de Produtos");

    await criarTitulo(app, e.accessToken, despesa, { descricao: "B tarde", dataVencimento: "2026-11-20" });
    await criarTitulo(app, e.accessToken, despesa, { descricao: "A cedo", dataVencimento: "2026-10-05" });
    await criarTitulo(app, e.accessToken, receita, { tipo: "RECEBER", descricao: "Venda", dataVencimento: "2026-10-15" });

    const todos = await request(app.getHttpServer()).get("/titulos").set(bearer(e.accessToken));
    expect(todos.body.map((t: { descricao: string }) => t.descricao)).toEqual(["A cedo", "Venda", "B tarde"]);

    const soReceber = await request(app.getHttpServer()).get("/titulos?tipo=RECEBER").set(bearer(e.accessToken));
    expect(soReceber.body).toHaveLength(1);

    const faixa = await request(app.getHttpServer())
      .get("/titulos?vencimentoDe=2026-10-10&vencimentoAte=2026-10-31")
      .set(bearer(e.accessToken));
    expect(faixa.body.map((t: { descricao: string }) => t.descricao)).toEqual(["Venda"]);

    const faixaInvertida = await request(app.getHttpServer())
      .get("/titulos?vencimentoDe=2026-11-01&vencimentoAte=2026-10-01")
      .set(bearer(e.accessToken));
    expect(faixaInvertida.status).toBe(400);
  });

  it("não aceita categoria de outra empresa (a FK sozinha deixaria passar) nem categoria inativa", async () => {
    const a = await novaEmpresa("Empresa A (refs)");
    const b = await novaEmpresa("Empresa B (refs)");
    const categoriaDeB = await categoriaPorNome(app, b.accessToken, "Aluguel");

    const cruzado = await criarTitulo(app, a.accessToken, categoriaDeB);
    expect(cruzado.status).toBe(404);

    const categoriaDeA = await categoriaPorNome(app, a.accessToken, "Aluguel");
    await request(app.getHttpServer())
      .patch(`/categorias/${categoriaDeA}`)
      .set(bearer(a.accessToken))
      .send({ ativo: false });
    const inativa = await criarTitulo(app, a.accessToken, categoriaDeA);
    expect(inativa.status).toBe(422);
  });

  it("empresa B não enxerga nem acessa o título da empresa A", async () => {
    const a = await novaEmpresa("Empresa A (isolamento)");
    const b = await novaEmpresa("Empresa B (isolamento)");
    const criado = await criarTitulo(app, a.accessToken, await categoriaPorNome(app, a.accessToken, "Aluguel"));

    const lista = await request(app.getHttpServer()).get("/titulos").set(bearer(b.accessToken));
    expect(lista.body).toHaveLength(0);

    const direto = await request(app.getHttpServer()).get(`/titulos/${criado.body.id}`).set(bearer(b.accessToken));
    expect(direto.status).toBe(404);

    const edicao = await request(app.getHttpServer())
      .patch(`/titulos/${criado.body.id}`)
      .set(bearer(b.accessToken))
      .send({ descricao: "invasão" });
    expect(edicao.status).toBe(404);
  });

  it("ANALISTA lista e consulta, mas não cria, edita nem cancela", async () => {
    const dona = await novaEmpresa("Empresa RBAC Títulos");
    const analista = await adicionarMembro(app, prisma, dona.empresaId, "ANALISTA");
    emails.push(analista.email);
    const criado = await criarTitulo(app, dona.accessToken, await categoriaPorNome(app, dona.accessToken, "Aluguel"));

    expect((await request(app.getHttpServer()).get("/titulos").set(bearer(analista.accessToken))).status).toBe(200);
    expect(
      (await request(app.getHttpServer()).get(`/titulos/${criado.body.id}`).set(bearer(analista.accessToken))).status,
    ).toBe(200);

    const categoriaId = await categoriaPorNome(app, analista.accessToken, "Aluguel");
    expect((await criarTitulo(app, analista.accessToken, categoriaId)).status).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/titulos/${criado.body.id}`)
          .set(bearer(analista.accessToken))
          .send({ descricao: "x y" })
      ).status,
    ).toBe(403);
    expect(
      (await request(app.getHttpServer()).post(`/titulos/${criado.body.id}/cancelar`).set(bearer(analista.accessToken)))
        .status,
    ).toBe(403);
  });

  it("edita título sem baixa: valor altera o saldo junto e a auditoria guarda antes e depois", async () => {
    const e = await novaEmpresa("Empresa Edição");
    const criado = await criarTitulo(app, e.accessToken, await categoriaPorNome(app, e.accessToken, "Aluguel"));

    const res = await request(app.getHttpServer())
      .patch(`/titulos/${criado.body.id}`)
      .set(bearer(e.accessToken))
      .send({ valorOriginal: "1200.00", descricao: "Aluguel reajustado" });

    expect(res.status).toBe(200);
    expect(res.body.saldoAberto).toBe("1200");
    expect(res.body.descricao).toBe("Aluguel reajustado");

    const trilha = await auditoriaDe(prisma, e.empresaId, criado.body.id);
    const update = trilha.find((t) => t.acao === "UPDATE");
    expect(update?.antes).toMatchObject({ valorOriginal: "1000.00", saldoAberto: "1000.00" });
    expect(update?.depois).toMatchObject({ valorOriginal: "1200.00", saldoAberto: "1200.00" });
  });

  it("cancela título sem baixa; depois disso não cancela de novo nem edita", async () => {
    const e = await novaEmpresa("Empresa Cancelamento");
    const criado = await criarTitulo(app, e.accessToken, await categoriaPorNome(app, e.accessToken, "Aluguel"));

    const cancelado = await request(app.getHttpServer())
      .post(`/titulos/${criado.body.id}/cancelar`)
      .set(bearer(e.accessToken));
    expect(cancelado.status).toBe(200);
    expect(cancelado.body.status).toBe("CANCELADO");

    expect(
      (await request(app.getHttpServer()).post(`/titulos/${criado.body.id}/cancelar`).set(bearer(e.accessToken))).status,
    ).toBe(409);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/titulos/${criado.body.id}`)
          .set(bearer(e.accessToken))
          .send({ descricao: "ainda dá?" })
      ).status,
    ).toBe(409);
  });
});

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
  criarConta,
  criarTitulo,
  limparEmpresa,
  registrarEmpresa,
} from "./helpers";

describe("Baixas (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const empresas: EmpresaDeTeste[] = [];
  const emails: string[] = [];

  async function cenario(nome: string, saldoConta = "5000.00") {
    const e = await registrarEmpresa(app, prisma, nome);
    empresas.push(e);
    emails.push(e.email);
    const contaId = await criarConta(app, e.accessToken, saldoConta);
    const despesa = await categoriaPorNome(app, e.accessToken, "Aluguel");
    const receita = await categoriaPorNome(app, e.accessToken, "Vendas de Produtos");
    return { e, contaId, despesa, receita };
  }

  const baixar = (token: string, tituloId: string, corpo: Record<string, unknown>) =>
    request(app.getHttpServer()).post(`/titulos/${tituloId}/baixas`).set(bearer(token)).send(corpo);

  async function saldoDaConta(token: string, contaId: string): Promise<string> {
    const res = await request(app.getHttpServer()).get("/contas-bancarias").set(bearer(token));
    return res.body.find((c: { id: string }) => c.id === contaId).saldoAtual;
  }

  async function obterTitulo(token: string, id: string) {
    return (await request(app.getHttpServer()).get(`/titulos/${id}`).set(bearer(token))).body;
  }

  beforeAll(async () => {
    ({ app, prisma } = await criarApp());
  });

  afterAll(async () => {
    for (const e of empresas) await limparEmpresa(prisma, e.empresaId, emails);
    await app.close();
  });

  it("baixa total de uma conta a pagar quita o título, debita a conta e audita com o autor", async () => {
    const { e, contaId, despesa } = await cenario("Baixa Total");
    const titulo = (await criarTitulo(app, e.accessToken, despesa, { valorOriginal: "1000.00" })).body;

    const res = await baixar(e.accessToken, titulo.id, { valorPago: "1000.00", data: "2026-10-05", contaBancariaId: contaId });

    expect(res.status).toBe(201);
    expect(res.body.titulo.status).toBe("PAGO");
    expect(res.body.titulo.saldoAberto).toBe("0");
    expect(await saldoDaConta(e.accessToken, contaId)).toBe("4000");

    const trilha = await auditoriaDe(prisma, e.empresaId, titulo.id);
    const baixa = trilha.find((t) => t.acao === "BAIXA");
    expect(baixa?.userId).toBe(e.userId);
    expect(baixa?.antes).toMatchObject({ status: "ABERTO", saldoAberto: "1000.00" });
    expect(baixa?.depois).toMatchObject({ status: "PAGO", baixa: { principalQuitado: "1000.00" } });
  });

  it("baixa de uma conta a receber credita a conta", async () => {
    const { e, contaId, receita } = await cenario("Baixa Receber", "100.00");
    const titulo = (await criarTitulo(app, e.accessToken, receita, { tipo: "RECEBER", valorOriginal: "250.00" })).body;

    await baixar(e.accessToken, titulo.id, { valorPago: "250.00", data: "2026-10-05", contaBancariaId: contaId });

    expect(await saldoDaConta(e.accessToken, contaId)).toBe("350");
  });

  it("duas baixas parciais em centavos zeram exatamente o saldo (0.10 + 0.20 em 0.30)", async () => {
    const { e, contaId, despesa } = await cenario("Baixa Parcial");
    const titulo = (await criarTitulo(app, e.accessToken, despesa, { valorOriginal: "0.30" })).body;

    const primeira = await baixar(e.accessToken, titulo.id, { valorPago: "0.10", data: "2026-10-05", contaBancariaId: contaId });
    expect(primeira.body.titulo.status).toBe("PARCIAL");
    expect(primeira.body.titulo.saldoAberto).toBe("0.2");

    const segunda = await baixar(e.accessToken, titulo.id, { valorPago: "0.20", data: "2026-10-06", contaBancariaId: contaId });
    expect(segunda.body.titulo.status).toBe("PAGO");
    expect(segunda.body.titulo.saldoAberto).toBe("0");

    const completo = await obterTitulo(e.accessToken, titulo.id);
    expect(completo.baixas).toHaveLength(2);
  });

  it("juros e desconto: pagar 1050 (60 de juros, 10 de desconto) quita o principal de 1000 e debita 1050 da conta", async () => {
    const { e, contaId, despesa } = await cenario("Baixa Juros");
    const titulo = (await criarTitulo(app, e.accessToken, despesa, { valorOriginal: "1000.00" })).body;

    const res = await baixar(e.accessToken, titulo.id, {
      valorPago: "1050.00",
      juros: "60.00",
      desconto: "10.00",
      data: "2026-10-25",
      contaBancariaId: contaId,
    });

    expect(res.status).toBe(201);
    expect(res.body.titulo.status).toBe("PAGO");
    expect(await saldoDaConta(e.accessToken, contaId)).toBe("3950");
  });

  it("baixa que excede o saldo é recusada com 422 e NADA muda (título, conta e auditoria intactos)", async () => {
    const { e, contaId, despesa } = await cenario("Baixa Excede");
    const titulo = (await criarTitulo(app, e.accessToken, despesa, { valorOriginal: "100.00" })).body;

    const res = await baixar(e.accessToken, titulo.id, { valorPago: "100.01", data: "2026-10-05", contaBancariaId: contaId });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe("EXCEDE_SALDO");
    expect((await obterTitulo(e.accessToken, titulo.id)).saldoAberto).toBe("100");
    expect(await saldoDaConta(e.accessToken, contaId)).toBe("5000");
    expect((await auditoriaDe(prisma, e.empresaId, titulo.id)).some((t) => t.acao === "BAIXA")).toBe(false);
    expect((await obterTitulo(e.accessToken, titulo.id)).baixas).toHaveLength(0);
  });

  it("pagamento que só cobre juros não quita principal nenhum (422)", async () => {
    const { e, contaId, despesa } = await cenario("Baixa Só Juros");
    const titulo = (await criarTitulo(app, e.accessToken, despesa)).body;

    const res = await baixar(e.accessToken, titulo.id, {
      valorPago: "50.00",
      juros: "50.00",
      data: "2026-10-25",
      contaBancariaId: contaId,
    });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe("PRINCIPAL_NAO_POSITIVO");
  });

  it("10 baixas simultâneas de 200 num título de 1000: exatamente 5 passam (lock de linha) e todos os saldos fecham", async () => {
    // Volume alto de propósito: com poucas requisições a janela da corrida é
    // pequena e o teste passaria por sorte mesmo sem o lock (verificado
    // removendo o FOR UPDATE: com 2 requisições só falhava 1 vez em 3).
    const { e, contaId, despesa } = await cenario("Baixa Concorrente");
    const titulo = (await criarTitulo(app, e.accessToken, despesa, { valorOriginal: "1000.00" })).body;
    const corpo = { valorPago: "200.00", data: "2026-10-05", contaBancariaId: contaId };

    const respostas = await Promise.all(
      Array.from({ length: 10 }, () => baixar(e.accessToken, titulo.id, corpo)),
    );

    const aceitas = respostas.filter((r) => r.status === 201).length;
    const recusadas = respostas.filter((r) => r.status === 422 || r.status === 409).length;
    expect(aceitas).toBe(5);
    expect(recusadas).toBe(5);

    const final = await obterTitulo(e.accessToken, titulo.id);
    expect(final.saldoAberto).toBe("0");
    expect(final.status).toBe("PAGO");
    expect(final.baixas).toHaveLength(5);
    expect(await saldoDaConta(e.accessToken, contaId)).toBe("4000");
  });

  it("não baixa título cancelado nem título já quitado (409)", async () => {
    const { e, contaId, despesa } = await cenario("Baixa Estados");
    const cancelado = (await criarTitulo(app, e.accessToken, despesa)).body;
    await request(app.getHttpServer()).post(`/titulos/${cancelado.id}/cancelar`).set(bearer(e.accessToken));
    const corpo = { valorPago: "10.00", data: "2026-10-05", contaBancariaId: contaId };
    expect((await baixar(e.accessToken, cancelado.id, corpo)).status).toBe(409);

    const quitado = (await criarTitulo(app, e.accessToken, despesa, { valorOriginal: "10.00" })).body;
    await baixar(e.accessToken, quitado.id, corpo);
    expect((await baixar(e.accessToken, quitado.id, corpo)).status).toBe(409);
  });

  it("após uma baixa ativa, valor e vencimento do título ficam travados; descrição continua editável", async () => {
    const { e, contaId, despesa } = await cenario("Baixa Trava");
    const titulo = (await criarTitulo(app, e.accessToken, despesa)).body;
    await baixar(e.accessToken, titulo.id, { valorPago: "100.00", data: "2026-10-05", contaBancariaId: contaId });

    const patch = (corpo: Record<string, unknown>) =>
      request(app.getHttpServer()).patch(`/titulos/${titulo.id}`).set(bearer(e.accessToken)).send(corpo);

    expect((await patch({ valorOriginal: "2000.00" })).status).toBe(409);
    expect((await patch({ dataVencimento: "2026-12-31" })).status).toBe(409);
    expect((await patch({ descricao: "Descrição nova" })).status).toBe(200);

    const cancelar = await request(app.getHttpServer()).post(`/titulos/${titulo.id}/cancelar`).set(bearer(e.accessToken));
    expect(cancelar.status).toBe(409);
  });

  it("recusa conta bancária de outra empresa (404) e papel ANALISTA (403)", async () => {
    const a = await cenario("Baixa Isolamento A");
    const b = await cenario("Baixa Isolamento B");
    const titulo = (await criarTitulo(app, a.e.accessToken, a.despesa)).body;
    const corpo = { valorPago: "10.00", data: "2026-10-05" };

    expect((await baixar(a.e.accessToken, titulo.id, { ...corpo, contaBancariaId: b.contaId })).status).toBe(404);
    expect((await baixar(b.e.accessToken, titulo.id, { ...corpo, contaBancariaId: b.contaId })).status).toBe(404);

    const analista = await adicionarMembro(app, prisma, a.e.empresaId, "ANALISTA");
    emails.push(analista.email);
    expect((await baixar(analista.accessToken, titulo.id, { ...corpo, contaBancariaId: a.contaId })).status).toBe(403);
  });
});

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

describe("Estorno com aprovação dupla (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const empresas: EmpresaDeTeste[] = [];
  const emails: string[] = [];

  // Empresa com dona (OWNER), um segundo usuário FINANCEIRO, conta e uma
  // baixa parcial de 400 num título de 1000 (saldo 600, conta 5000 → 4600).
  async function cenario(nome: string, tipo: "PAGAR" | "RECEBER" = "PAGAR") {
    const dona = await registrarEmpresa(app, prisma, nome);
    empresas.push(dona);
    emails.push(dona.email);
    const financeiro = await adicionarMembro(app, prisma, dona.empresaId, "FINANCEIRO");
    emails.push(financeiro.email);
    const contaId = await criarConta(app, dona.accessToken, "5000.00");
    const categoriaId = await categoriaPorNome(
      app,
      dona.accessToken,
      tipo === "PAGAR" ? "Aluguel" : "Vendas de Produtos",
    );
    const titulo = (await criarTitulo(app, dona.accessToken, categoriaId, { tipo, valorOriginal: "1000.00" })).body;
    const baixa = (
      await request(app.getHttpServer())
        .post(`/titulos/${titulo.id}/baixas`)
        .set(bearer(dona.accessToken))
        .send({ valorPago: "400.00", data: "2026-10-05", contaBancariaId: contaId })
    ).body.baixa;
    return { dona, financeiro, contaId, titulo, baixa };
  }

  const solicitar = (token: string, baixaId: string, motivo = "Pagamento lançado em duplicidade") =>
    request(app.getHttpServer()).post(`/baixas/${baixaId}/estorno`).set(bearer(token)).send({ motivo });
  const decidir = (token: string, estornoId: string, acao: "aprovar" | "rejeitar", corpo: object = {}) =>
    request(app.getHttpServer()).post(`/estornos/${estornoId}/${acao}`).set(bearer(token)).send(corpo);
  const obterTitulo = async (token: string, id: string) =>
    (await request(app.getHttpServer()).get(`/titulos/${id}`).set(bearer(token))).body;
  const saldoDaConta = async (token: string, contaId: string): Promise<string> =>
    (await request(app.getHttpServer()).get("/contas-bancarias").set(bearer(token))).body.find(
      (c: { id: string }) => c.id === contaId,
    ).saldoAtual;

  beforeAll(async () => {
    ({ app, prisma } = await criarApp());
  });

  afterAll(async () => {
    for (const e of empresas) await limparEmpresa(prisma, e.empresaId, emails);
    await app.close();
  });

  it("solicitar não mexe em saldo nenhum — o estorno só vale depois de aprovado", async () => {
    const { dona, contaId, titulo, baixa } = await cenario("Estorno Solicitação");

    const res = await solicitar(dona.accessToken, baixa.id);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDENTE");
    expect(res.body.solicitadoPor).toBe(dona.userId);
    expect((await obterTitulo(dona.accessToken, titulo.id)).saldoAberto).toBe("600");
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("4600");
  });

  it("quem solicitou não pode aprovar nem rejeitar o próprio estorno (403) e nada muda", async () => {
    const { dona, contaId, titulo, baixa } = await cenario("Estorno Autoaprovação");
    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;

    expect((await decidir(dona.accessToken, estorno.id, "aprovar")).status).toBe(403);
    expect(
      (await decidir(dona.accessToken, estorno.id, "rejeitar", { motivo: "Eu mesmo desisti" })).status,
    ).toBe(403);

    expect((await obterTitulo(dona.accessToken, titulo.id)).saldoAberto).toBe("600");
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("4600");
    const fila = await request(app.getHttpServer()).get("/estornos?status=PENDENTE").set(bearer(dona.accessToken));
    expect(fila.body).toHaveLength(1);
  });

  it("outro usuário aprova: baixa estornada, saldo do título e da conta revertidos, auditoria com os dois autores", async () => {
    const { dona, financeiro, contaId, titulo, baixa } = await cenario("Estorno Aprovação");
    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;

    const res = await decidir(financeiro.accessToken, estorno.id, "aprovar");

    expect(res.status).toBe(200);
    expect(res.body.titulo.status).toBe("ABERTO");
    expect(res.body.titulo.saldoAberto).toBe("1000");
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("5000");

    const completo = await obterTitulo(dona.accessToken, titulo.id);
    expect(completo.baixas[0].estornadaEm).not.toBeNull();
    expect(completo.baixas[0].estornoSolicitacao.status).toBe("APROVADO");
    expect(completo.baixas[0].estornoSolicitacao.aprovadoPor).toBe(financeiro.userId);

    const trilha = await auditoriaDe(prisma, dona.empresaId, titulo.id);
    expect(trilha.map((t) => t.acao)).toEqual(["CREATE", "BAIXA", "ESTORNO_SOLICITADO", "ESTORNO_APROVADO"]);
    expect(trilha[2]?.userId).toBe(dona.userId);
    expect(trilha[3]?.userId).toBe(financeiro.userId);
    expect(trilha[3]?.depois).toMatchObject({ estorno: { principalDevolvido: "400.00" } });
  });

  it("estorno de baixa com juros e desconto devolve só o principal ao título, mas todo o caixa à conta", async () => {
    const { dona, financeiro, contaId, titulo } = await cenario("Estorno Juros");
    // Segunda baixa: paga 560 com 60 de juros → principal 500 (saldo 600 → 100).
    const segunda = (
      await request(app.getHttpServer())
        .post(`/titulos/${titulo.id}/baixas`)
        .set(bearer(dona.accessToken))
        .send({ valorPago: "560.00", juros: "60.00", data: "2026-10-20", contaBancariaId: contaId })
    ).body.baixa;
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("4040");

    const estorno = (await solicitar(dona.accessToken, segunda.id)).body;
    await decidir(financeiro.accessToken, estorno.id, "aprovar");

    expect((await obterTitulo(dona.accessToken, titulo.id)).saldoAberto).toBe("600");
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("4600");
    expect((await obterTitulo(dona.accessToken, titulo.id)).status).toBe("PARCIAL");
  });

  it("estornar baixa de título a receber debita a conta de volta", async () => {
    const { dona, financeiro, contaId, baixa } = await cenario("Estorno Receber", "RECEBER");
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("5400");

    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;
    await decidir(financeiro.accessToken, estorno.id, "aprovar");

    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("5000");
  });

  it("rejeitar exige justificativa, não mexe em saldo, e a solicitação pode ser reaberta depois", async () => {
    const { dona, financeiro, contaId, titulo, baixa } = await cenario("Estorno Rejeição");
    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;

    expect((await decidir(financeiro.accessToken, estorno.id, "rejeitar", {})).status).toBe(400);
    const rejeitado = await decidir(financeiro.accessToken, estorno.id, "rejeitar", {
      motivo: "Comprovante confere, pagamento correto",
    });
    expect(rejeitado.status).toBe(200);
    expect(rejeitado.body.status).toBe("REJEITADO");
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("4600");

    // Já decidida: não dá pra decidir de novo.
    expect((await decidir(financeiro.accessToken, estorno.id, "aprovar")).status).toBe(409);

    // Reabertura (baixaId é único: reaproveita a linha).
    const reaberta = await solicitar(financeiro.accessToken, baixa.id, "Novo comprovante mostra duplicidade");
    expect(reaberta.status).toBe(201);
    expect(reaberta.body.status).toBe("PENDENTE");
    expect(reaberta.body.solicitadoPor).toBe(financeiro.userId);
    expect(reaberta.body.aprovadoPor).toBeNull();

    const trilha = await auditoriaDe(prisma, dona.empresaId, titulo.id);
    expect(trilha.find((t) => t.acao === "ESTORNO_REJEITADO")?.depois).toMatchObject({
      motivoRejeicao: "Comprovante confere, pagamento correto",
    });
  });

  it("não aceita segunda solicitação enquanto há uma pendente, nem estornar baixa já estornada (409)", async () => {
    const { dona, financeiro, baixa } = await cenario("Estorno Duplicado");
    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;
    expect((await solicitar(financeiro.accessToken, baixa.id)).status).toBe(409);

    await decidir(financeiro.accessToken, estorno.id, "aprovar");
    expect((await solicitar(dona.accessToken, baixa.id)).status).toBe(409);
  });

  it("duas aprovações simultâneas do mesmo estorno: uma passa, a outra 409, saldo devolvido uma vez só", async () => {
    const { dona, financeiro, contaId, titulo, baixa } = await cenario("Estorno Concorrente");
    const segundoFinanceiro = await adicionarMembro(app, prisma, dona.empresaId, "OWNER");
    emails.push(segundoFinanceiro.email);
    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;

    // Volume alto de propósito: com poucas requisições a janela da corrida
    // raramente abre e o teste passaria por sorte mesmo com o código quebrado.
    const aprovadores = [financeiro, segundoFinanceiro];
    const respostas = await Promise.all(
      Array.from({ length: 16 }, (_, i) => decidir(aprovadores[i % 2]!.accessToken, estorno.id, "aprovar")),
    );

    expect(respostas.filter((r) => r.status === 200)).toHaveLength(1);
    expect(respostas.filter((r) => r.status === 409)).toHaveLength(15);
    expect(await saldoDaConta(dona.accessToken, contaId)).toBe("5000");
    expect((await obterTitulo(dona.accessToken, titulo.id)).saldoAberto).toBe("1000");
  });

  it("depois do estorno aprovado o título volta a ser editável e cancelável (sem baixa ativa)", async () => {
    const { dona, financeiro, titulo, baixa } = await cenario("Estorno Libera Edição");
    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;
    await decidir(financeiro.accessToken, estorno.id, "aprovar");

    const edicao = await request(app.getHttpServer())
      .patch(`/titulos/${titulo.id}`)
      .set(bearer(dona.accessToken))
      .send({ valorOriginal: "900.00" });
    expect(edicao.status).toBe(200);
    expect(edicao.body.saldoAberto).toBe("900");

    const cancelar = await request(app.getHttpServer()).post(`/titulos/${titulo.id}/cancelar`).set(bearer(dona.accessToken));
    expect(cancelar.status).toBe(200);
  });

  it("ANALISTA não solicita nem decide, mas vê a fila; outra empresa não vê nem decide nada", async () => {
    const { dona, financeiro, baixa } = await cenario("Estorno RBAC");
    const analista = await adicionarMembro(app, prisma, dona.empresaId, "ANALISTA");
    emails.push(analista.email);
    const outra = await registrarEmpresa(app, prisma, "Estorno Outra Empresa");
    empresas.push(outra);
    emails.push(outra.email);

    expect((await solicitar(analista.accessToken, baixa.id)).status).toBe(403);
    const estorno = (await solicitar(dona.accessToken, baixa.id)).body;
    expect((await decidir(analista.accessToken, estorno.id, "aprovar")).status).toBe(403);
    expect(
      (await request(app.getHttpServer()).get("/estornos").set(bearer(analista.accessToken))).status,
    ).toBe(200);

    expect((await request(app.getHttpServer()).get("/estornos").set(bearer(outra.accessToken))).body).toHaveLength(0);
    expect((await solicitar(outra.accessToken, baixa.id)).status).toBe(404);
    expect((await decidir(outra.accessToken, estorno.id, "aprovar")).status).toBe(404);
    expect(financeiro.userId).toBeDefined();
  });
});

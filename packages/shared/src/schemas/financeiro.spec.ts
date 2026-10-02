import {
  atualizarTituloSchema,
  criarTituloSchema,
  listarEstornosQuerySchema,
  listarTitulosQuerySchema,
  registrarBaixaSchema,
  rejeitarEstornoSchema,
  solicitarEstornoSchema,
} from "./financeiro";

const ID = "123e4567-e89b-12d3-a456-426614174000";

const tituloValido = {
  tipo: "PAGAR",
  descricao: "Aluguel de outubro",
  valorOriginal: "3500.00",
  categoriaId: ID,
  dataEmissao: "2026-10-01",
  dataVencimento: "2026-10-10",
} as const;

describe("criarTituloSchema", () => {
  it("aceita um título válido e mantém o valor como string decimal", () => {
    const r = criarTituloSchema.parse(tituloValido);
    expect(r.valorOriginal).toBe("3500.00");
  });

  it("aceita vencimento no mesmo dia da emissão (à vista)", () => {
    expect(() =>
      criarTituloSchema.parse({ ...tituloValido, dataVencimento: "2026-10-01" }),
    ).not.toThrow();
  });

  it("rejeita vencimento anterior à emissão e aponta o campo certo", () => {
    const r = criarTituloSchema.safeParse({ ...tituloValido, dataVencimento: "2026-09-30" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["dataVencimento"]);
    }
  });

  it("rejeita valor zero e valor com 3 casas decimais", () => {
    expect(criarTituloSchema.safeParse({ ...tituloValido, valorOriginal: "0.00" }).success).toBe(false);
    expect(criarTituloSchema.safeParse({ ...tituloValido, valorOriginal: "10.999" }).success).toBe(false);
  });

  it("rejeita data que não existe no calendário", () => {
    expect(criarTituloSchema.safeParse({ ...tituloValido, dataEmissao: "2026-13-45" }).success).toBe(false);
  });

  it("rejeita tipo fora de PAGAR/RECEBER e categoria que não é UUID", () => {
    expect(criarTituloSchema.safeParse({ ...tituloValido, tipo: "TRANSFERENCIA" }).success).toBe(false);
    expect(criarTituloSchema.safeParse({ ...tituloValido, categoriaId: "abc" }).success).toBe(false);
  });
});

describe("atualizarTituloSchema", () => {
  it("aceita atualizar só a descrição", () => {
    expect(atualizarTituloSchema.parse({ descricao: "Novo texto" })).toEqual({ descricao: "Novo texto" });
  });

  it("rejeita payload vazio", () => {
    expect(() => atualizarTituloSchema.parse({})).toThrow(/ao menos um campo/);
  });
});

describe("listarTitulosQuerySchema", () => {
  it("aceita sem nenhum filtro", () => {
    expect(listarTitulosQuerySchema.parse({})).toEqual({});
  });

  it("aceita faixa de vencimento válida e status/tipo do enum", () => {
    const r = listarTitulosQuerySchema.parse({
      tipo: "RECEBER",
      status: "PARCIAL",
      vencimentoDe: "2026-10-01",
      vencimentoAte: "2026-10-31",
    });
    expect(r.status).toBe("PARCIAL");
  });

  it("rejeita faixa invertida e aponta vencimentoAte", () => {
    const r = listarTitulosQuerySchema.safeParse({ vencimentoDe: "2026-11-01", vencimentoAte: "2026-10-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["vencimentoAte"]);
  });

  it("rejeita status inexistente", () => {
    expect(listarTitulosQuerySchema.safeParse({ status: "ATRASADO" }).success).toBe(false);
  });
});

describe("registrarBaixaSchema", () => {
  const baixaValida = { valorPago: "400.00", data: "2026-10-05", contaBancariaId: ID };

  it("juros, multa e desconto assumem 0 quando omitidos", () => {
    const r = registrarBaixaSchema.parse(baixaValida);
    expect([r.juros, r.multa, r.desconto]).toEqual(["0", "0", "0"]);
  });

  it("rejeita juros negativo (acréscimo nunca é negativo)", () => {
    expect(registrarBaixaSchema.safeParse({ ...baixaValida, juros: "-5.00" }).success).toBe(false);
  });

  it("rejeita valorPago zero", () => {
    expect(registrarBaixaSchema.safeParse({ ...baixaValida, valorPago: "0" }).success).toBe(false);
  });
});

describe("listarEstornosQuerySchema / rejeitarEstornoSchema", () => {
  it("filtro de status só aceita valores do enum", () => {
    expect(listarEstornosQuerySchema.safeParse({ status: "PENDENTE" }).success).toBe(true);
    expect(listarEstornosQuerySchema.safeParse({ status: "CANCELADO" }).success).toBe(false);
  });

  it("rejeitar sem justificativa não passa", () => {
    expect(rejeitarEstornoSchema.safeParse({ motivo: "não" }).success).toBe(false);
    expect(rejeitarEstornoSchema.safeParse({ motivo: "Comprovante não confere" }).success).toBe(true);
  });
});

describe("solicitarEstornoSchema", () => {
  it("exige motivo com conteúdo real (mínimo 5 caracteres)", () => {
    expect(solicitarEstornoSchema.safeParse({ motivo: "ok" }).success).toBe(false);
    expect(solicitarEstornoSchema.safeParse({ motivo: "Pagamento duplicado" }).success).toBe(true);
  });

  it("remove espaços nas pontas antes de validar o tamanho", () => {
    expect(solicitarEstornoSchema.safeParse({ motivo: "   a   " }).success).toBe(false);
  });
});

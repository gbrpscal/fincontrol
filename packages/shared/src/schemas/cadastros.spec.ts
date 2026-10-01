import {
  atualizarCategoriaSchema,
  criarCategoriaSchema,
  criarClienteFornecedorSchema,
  criarContaBancariaManualSchema,
  criarCentroCustoSchema,
} from "./cadastros";

describe("criarCategoriaSchema", () => {
  it("aceita uma categoria raiz válida", () => {
    const resultado = criarCategoriaSchema.parse({ nome: "Despesas Administrativas", tipo: "DESPESA" });
    expect(resultado.parentId).toBeUndefined();
  });

  it("aceita uma subcategoria com parentId", () => {
    const parentId = "123e4567-e89b-12d3-a456-426614174000";
    const resultado = criarCategoriaSchema.parse({ nome: "Aluguel", tipo: "DESPESA", parentId });
    expect(resultado.parentId).toBe(parentId);
  });

  it("rejeita tipo fora do enum (não existe categoria 'LUCRO')", () => {
    expect(() =>
      criarCategoriaSchema.parse({ nome: "Categoria Inválida", tipo: "LUCRO" }),
    ).toThrow();
  });

  it("rejeita nome vazio ou só com 1 caractere", () => {
    expect(() => criarCategoriaSchema.parse({ nome: "", tipo: "RECEITA" })).toThrow();
    expect(() => criarCategoriaSchema.parse({ nome: "A", tipo: "RECEITA" })).toThrow();
  });

  it("rejeita parentId que não é um UUID", () => {
    expect(() =>
      criarCategoriaSchema.parse({ nome: "Aluguel", tipo: "DESPESA", parentId: "não-é-uuid" }),
    ).toThrow();
  });

  it("remove espaços nas pontas do nome (trim)", () => {
    const resultado = criarCategoriaSchema.parse({ nome: "  Vendas  ", tipo: "RECEITA" });
    expect(resultado.nome).toBe("Vendas");
  });
});

describe("atualizarCategoriaSchema", () => {
  it("aceita atualizar só o nome", () => {
    expect(atualizarCategoriaSchema.parse({ nome: "Novo Nome" })).toEqual({ nome: "Novo Nome" });
  });

  it("aceita atualizar só o status ativo", () => {
    expect(atualizarCategoriaSchema.parse({ ativo: false })).toEqual({ ativo: false });
  });

  it("rejeita um payload vazio — precisa mudar pelo menos um campo", () => {
    expect(() => atualizarCategoriaSchema.parse({})).toThrow(/ao menos um campo/);
  });
});

describe("criarCentroCustoSchema", () => {
  it("aceita um nome válido", () => {
    expect(criarCentroCustoSchema.parse({ nome: "Filial Centro" }).nome).toBe("Filial Centro");
  });

  it("rejeita nome muito curto", () => {
    expect(() => criarCentroCustoSchema.parse({ nome: "F" })).toThrow();
  });
});

describe("criarClienteFornecedorSchema", () => {
  it("aceita um fornecedor com CNPJ (14 dígitos)", () => {
    const resultado = criarClienteFornecedorSchema.parse({
      nome: "Fornecedor LTDA",
      documento: "12345678000199",
      tipo: "FORNECEDOR",
    });
    expect(resultado.documento).toBe("12345678000199");
  });

  it("aceita um cliente com CPF (11 dígitos)", () => {
    const resultado = criarClienteFornecedorSchema.parse({
      nome: "Cliente Pessoa Física",
      documento: "12345678901",
      tipo: "CLIENTE",
    });
    expect(resultado.documento).toBe("12345678901");
  });

  it("rejeita documento com quantidade de dígitos errada (nem CPF nem CNPJ)", () => {
    expect(() =>
      criarClienteFornecedorSchema.parse({ nome: "X", documento: "123", tipo: "CLIENTE" }),
    ).toThrow();
  });

  it("rejeita documento com pontuação (não aceita formatado, só dígitos)", () => {
    expect(() =>
      criarClienteFornecedorSchema.parse({
        nome: "Fornecedor LTDA",
        documento: "12.345.678/0001-99",
        tipo: "FORNECEDOR",
      }),
    ).toThrow();
  });

  it("rejeita e-mail malformado", () => {
    expect(() =>
      criarClienteFornecedorSchema.parse({ nome: "X", tipo: "CLIENTE", email: "não-é-email" }),
    ).toThrow();
  });

  it("documento e e-mail são opcionais — aceita sem eles", () => {
    expect(() => criarClienteFornecedorSchema.parse({ nome: "Cliente Simples", tipo: "CLIENTE" })).not.toThrow();
  });
});

describe("criarContaBancariaManualSchema", () => {
  it("aceita saldo inicial decimal válido", () => {
    const resultado = criarContaBancariaManualSchema.parse({
      nome: "Conta Corrente Principal",
      tipo: "CORRENTE",
      saldoInicial: "1500.50",
    });
    expect(resultado.saldoInicial).toBe("1500.50");
  });

  it("usa 0 como padrão quando saldoInicial não é informado", () => {
    const resultado = criarContaBancariaManualSchema.parse({ nome: "Caixa Loja", tipo: "CAIXA" });
    expect(resultado.saldoInicial).toBe("0");
  });

  it("aceita saldo inicial negativo (conta já nasce no vermelho)", () => {
    const resultado = criarContaBancariaManualSchema.parse({
      nome: "Conta Nova",
      tipo: "CORRENTE",
      saldoInicial: "-250.00",
    });
    expect(resultado.saldoInicial).toBe("-250.00");
  });

  it("rejeita saldo com mais de 2 casas decimais (não é precisão monetária válida)", () => {
    expect(() =>
      criarContaBancariaManualSchema.parse({ nome: "Conta X", tipo: "CORRENTE", saldoInicial: "10.999" }),
    ).toThrow();
  });

  it("rejeita saldo em formato não numérico", () => {
    expect(() =>
      criarContaBancariaManualSchema.parse({ nome: "Conta X", tipo: "CORRENTE", saldoInicial: "mil reais" }),
    ).toThrow();
  });

  it("rejeita tipo de conta fora do enum", () => {
    expect(() =>
      criarContaBancariaManualSchema.parse({ nome: "Conta X", tipo: "INVESTIMENTO" }),
    ).toThrow();
  });
});

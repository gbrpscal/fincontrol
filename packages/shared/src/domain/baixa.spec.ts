import { BaixaInvalidaError, calcularBaixa } from "./baixa";

const semAjustes = { juros: "0", multa: "0", desconto: "0" };

describe("calcularBaixa", () => {
  it("baixa total simples zera o saldo e marca como quitado", () => {
    const r = calcularBaixa({ saldoAberto: "1000.00", valorPago: "1000.00", ...semAjustes });
    expect(r).toEqual({ principalQuitado: "1000.00", novoSaldo: "0.00", quitado: true });
  });

  it("baixa parcial deixa saldo residual e não quita", () => {
    const r = calcularBaixa({ saldoAberto: "1000.00", valorPago: "400.00", ...semAjustes });
    expect(r).toEqual({ principalQuitado: "400.00", novoSaldo: "600.00", quitado: false });
  });

  it("juros e desconto: paga 1050 com 60 de juros e 10 de desconto e quita exatamente 1000 de principal", () => {
    const r = calcularBaixa({
      saldoAberto: "1000.00",
      valorPago: "1050.00",
      juros: "60.00",
      multa: "0",
      desconto: "10.00",
    });
    expect(r.principalQuitado).toBe("1000.00");
    expect(r.quitado).toBe(true);
  });

  it("juros e multa não reduzem a dívida: pagar 500 com 50 de juros e 20 de multa abate só 430", () => {
    const r = calcularBaixa({
      saldoAberto: "1000.00",
      valorPago: "500.00",
      juros: "50.00",
      multa: "20.00",
      desconto: "0",
    });
    expect(r.principalQuitado).toBe("430.00");
    expect(r.novoSaldo).toBe("570.00");
  });

  it("desconto quita parte do saldo sem entrar no caixa: pagar 40 com 60 de desconto quita 100", () => {
    const r = calcularBaixa({
      saldoAberto: "100.00",
      valorPago: "40.00",
      juros: "0",
      multa: "0",
      desconto: "60.00",
    });
    expect(r).toEqual({ principalQuitado: "100.00", novoSaldo: "0.00", quitado: true });
  });

  it("duas baixas parciais em centavos zeram o saldo exatamente (sem erro de ponto flutuante)", () => {
    // Em float: 0.30 - 0.10 - 0.20 = 5.55e-17, nunca zero.
    const primeira = calcularBaixa({ saldoAberto: "0.30", valorPago: "0.10", ...semAjustes });
    expect(primeira.novoSaldo).toBe("0.20");
    expect(primeira.quitado).toBe(false);

    const segunda = calcularBaixa({ saldoAberto: primeira.novoSaldo, valorPago: "0.20", ...semAjustes });
    expect(segunda.novoSaldo).toBe("0.00");
    expect(segunda.quitado).toBe(true);
  });

  it("rejeita baixa que quita 1 centavo a mais que o saldo", () => {
    expect.assertions(2);
    try {
      calcularBaixa({ saldoAberto: "100.00", valorPago: "100.01", ...semAjustes });
    } catch (erro) {
      expect(erro).toBeInstanceOf(BaixaInvalidaError);
      expect((erro as BaixaInvalidaError).codigo).toBe("EXCEDE_SALDO");
    }
  });

  it("rejeita desconto que faria o principal ultrapassar o saldo (pago 80 + desconto 30 em saldo 100)", () => {
    expect.assertions(1);
    try {
      calcularBaixa({ saldoAberto: "100.00", valorPago: "80.00", juros: "0", multa: "0", desconto: "30.00" });
    } catch (erro) {
      expect((erro as BaixaInvalidaError).codigo).toBe("EXCEDE_SALDO");
    }
  });

  it("rejeita pagamento que só cobre juros (principal zero)", () => {
    expect.assertions(1);
    try {
      calcularBaixa({ saldoAberto: "100.00", valorPago: "50.00", juros: "50.00", multa: "0", desconto: "0" });
    } catch (erro) {
      expect((erro as BaixaInvalidaError).codigo).toBe("PRINCIPAL_NAO_POSITIVO");
    }
  });

  it("rejeita pagamento menor que juros + multa (principal negativo)", () => {
    expect.assertions(1);
    try {
      calcularBaixa({ saldoAberto: "100.00", valorPago: "10.00", juros: "8.00", multa: "5.00", desconto: "0" });
    } catch (erro) {
      expect((erro as BaixaInvalidaError).codigo).toBe("PRINCIPAL_NAO_POSITIVO");
    }
  });
});

import Decimal from "decimal.js";

export type CodigoBaixaInvalida = "PRINCIPAL_NAO_POSITIVO" | "EXCEDE_SALDO";

export class BaixaInvalidaError extends Error {
  readonly codigo: CodigoBaixaInvalida;

  constructor(codigo: CodigoBaixaInvalida, mensagem: string) {
    super(mensagem);
    this.name = "BaixaInvalidaError";
    this.codigo = codigo;
  }
}

export interface CalcularBaixaInput {
  saldoAberto: string;
  valorPago: string;
  juros: string;
  multa: string;
  desconto: string;
}

export interface CalcularBaixaResultado {
  principalQuitado: string;
  novoSaldo: string;
  quitado: boolean;
}

// Regra confirmada: o caixa movimentado é o valorPago, mas só o PRINCIPAL
// abate o saldo do título. Juros e multa são acréscimo (entram no caixa sem
// reduzir a dívida) e desconto é abatimento (reduz o caixa sem deixar saldo):
//   principalQuitado = valorPago − juros − multa + desconto
// Aritmética sempre em Decimal — com float, 0.1 + 0.2 ≠ 0.3 e o saldo de
// um título parcelado em centavos nunca zeraria direito.
export function calcularBaixa(input: CalcularBaixaInput): CalcularBaixaResultado {
  const saldo = new Decimal(input.saldoAberto);
  const principal = new Decimal(input.valorPago)
    .minus(input.juros)
    .minus(input.multa)
    .plus(input.desconto);

  if (principal.lte(0)) {
    throw new BaixaInvalidaError(
      "PRINCIPAL_NAO_POSITIVO",
      "O valor pago, descontados juros e multa, não quita nenhuma parte do principal.",
    );
  }
  if (principal.gt(saldo)) {
    throw new BaixaInvalidaError(
      "EXCEDE_SALDO",
      "A baixa quita mais do que o saldo em aberto do título.",
    );
  }

  const novoSaldo = saldo.minus(principal);
  return {
    principalQuitado: principal.toFixed(2),
    novoSaldo: novoSaldo.toFixed(2),
    quitado: novoSaldo.isZero(),
  };
}

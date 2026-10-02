export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;

interface TipoPermitido {
  extensao: string;
  assinatura: number[];
}

// Tipo é validado pelo CONTEÚDO (magic bytes), não só pelo mime que o cliente
// declara — o cliente pode mentir, e um executável renomeado para .pdf não
// pode virar um "boleto" armazenado.
const TIPOS: Record<string, TipoPermitido> = {
  "application/pdf": { extensao: ".pdf", assinatura: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  "image/png": { extensao: ".png", assinatura: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/jpeg": { extensao: ".jpg", assinatura: [0xff, 0xd8, 0xff] },
};

export function tipoPermitido(mime: string): TipoPermitido | undefined {
  return TIPOS[mime];
}

export function conteudoCorrespondeAoTipo(conteudo: Buffer, tipo: TipoPermitido): boolean {
  return tipo.assinatura.every((byte, i) => conteudo[i] === byte);
}

// Só o nome-base, sem diretórios, sem caracteres de controle, com limite de
// tamanho. Serve para exibir/baixar — nunca para montar caminho de arquivo.
export function sanitizarNomeArquivo(nomeOriginal: string): string {
  // multer entrega o nome como latin1; reinterpreta como UTF-8 (acentos).
  const decodificado = Buffer.from(nomeOriginal, "latin1").toString("utf8");
  const base = decodificado.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const limpo = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return limpo.length > 0 ? limpo : "arquivo";
}

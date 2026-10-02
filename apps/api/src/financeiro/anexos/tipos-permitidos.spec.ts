import {
  conteudoCorrespondeAoTipo,
  sanitizarNomeArquivo,
  tipoPermitido,
} from "./tipos-permitidos";

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(32)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const EXECUTAVEL_WINDOWS = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);

describe("tipoPermitido", () => {
  it("aceita só PDF, PNG e JPEG", () => {
    expect(tipoPermitido("application/pdf")?.extensao).toBe(".pdf");
    expect(tipoPermitido("image/png")?.extensao).toBe(".png");
    expect(tipoPermitido("image/jpeg")?.extensao).toBe(".jpg");
  });

  it("recusa tipos fora da lista (texto, html, executável, svg)", () => {
    for (const mime of ["text/plain", "text/html", "application/x-msdownload", "image/svg+xml", ""]) {
      expect(tipoPermitido(mime)).toBeUndefined();
    }
  });
});

describe("conteudoCorrespondeAoTipo", () => {
  it("confirma o conteúdo real de cada tipo", () => {
    expect(conteudoCorrespondeAoTipo(PDF, tipoPermitido("application/pdf")!)).toBe(true);
    expect(conteudoCorrespondeAoTipo(PNG, tipoPermitido("image/png")!)).toBe(true);
    expect(conteudoCorrespondeAoTipo(JPEG, tipoPermitido("image/jpeg")!)).toBe(true);
  });

  it("recusa executável declarado como PDF (cliente mentindo no mime)", () => {
    expect(conteudoCorrespondeAoTipo(EXECUTAVEL_WINDOWS, tipoPermitido("application/pdf")!)).toBe(false);
  });

  it("recusa troca entre tipos válidos (PNG declarado como PDF e vice-versa)", () => {
    expect(conteudoCorrespondeAoTipo(PNG, tipoPermitido("application/pdf")!)).toBe(false);
    expect(conteudoCorrespondeAoTipo(PDF, tipoPermitido("image/png")!)).toBe(false);
  });

  it("recusa arquivo vazio ou menor que a assinatura", () => {
    expect(conteudoCorrespondeAoTipo(Buffer.alloc(0), tipoPermitido("application/pdf")!)).toBe(false);
    expect(conteudoCorrespondeAoTipo(Buffer.from("%PD"), tipoPermitido("application/pdf")!)).toBe(false);
  });
});

describe("sanitizarNomeArquivo", () => {
  it("mantém um nome comum", () => {
    expect(sanitizarNomeArquivo("boleto-outubro.pdf")).toBe("boleto-outubro.pdf");
  });

  it("remove diretórios de path traversal (unix e windows)", () => {
    expect(sanitizarNomeArquivo("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizarNomeArquivo("..\\..\\windows\\system32\\cmd.pdf")).toBe("cmd.pdf");
  });

  it("remove caracteres de controle (quebra de linha injetada em header)", () => {
    expect(sanitizarNomeArquivo("nota\r\nSet-Cookie: x=1.pdf")).toBe("notaSet-Cookie: x=1.pdf");
  });

  it("nome vazio ou só de separadores vira 'arquivo'", () => {
    expect(sanitizarNomeArquivo("")).toBe("arquivo");
    expect(sanitizarNomeArquivo("///")).toBe("arquivo");
  });

  it("limita o tamanho a 200 caracteres", () => {
    expect(sanitizarNomeArquivo("a".repeat(500) + ".pdf")).toHaveLength(200);
  });

  it("recompõe acentos que o multer entrega como latin1", () => {
    const comoMulterEntrega = Buffer.from("Comprovante nº 1 — João.pdf", "utf8").toString("latin1");
    expect(sanitizarNomeArquivo(comoMulterEntrega)).toBe("Comprovante nº 1 — João.pdf");
  });
});

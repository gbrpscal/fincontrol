import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { AuditService } from "../../audit/audit.service";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { ANEXO_STORAGE, type AnexoStoragePort } from "./anexo-storage.port";
import {
  conteudoCorrespondeAoTipo,
  sanitizarNomeArquivo,
  tipoPermitido,
} from "./tipos-permitidos";

// A chave interna do storage (`url`) carrega empresaId/tituloId e nunca sai
// pela API — as respostas devolvem só estes campos.
const ANEXO_PUBLICO = {
  id: true,
  tituloId: true,
  nomeArquivo: true,
  tipoMime: true,
  tamanhoBytes: true,
  enviadoPor: true,
  createdAt: true,
} as const;

export interface ArquivoRecebido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class AnexosService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    @Inject(ANEXO_STORAGE) private readonly storage: AnexoStoragePort,
  ) {}

  async enviar(tituloId: string, arquivo: ArquivoRecebido) {
    const titulo = await this.tenantPrisma.client.titulo.findUnique({ where: { id: tituloId } });
    if (!titulo) {
      throw new NotFoundException("Título não encontrado.");
    }

    const tipo = tipoPermitido(arquivo.mimetype);
    if (!tipo) {
      throw new UnsupportedMediaTypeException("Tipo de arquivo não permitido. Envie PDF, PNG ou JPEG.");
    }
    if (!conteudoCorrespondeAoTipo(arquivo.buffer, tipo)) {
      throw new UnsupportedMediaTypeException("O conteúdo do arquivo não corresponde ao tipo informado.");
    }

    // A chave nunca usa o nome enviado pelo cliente: uuid + extensão do tipo
    // validado. O nome original só é guardado como metadado de exibição.
    const chave = `${this.tenantPrisma.empresaId}/${tituloId}/${randomUUID()}${tipo.extensao}`;
    const nomeArquivo = sanitizarNomeArquivo(arquivo.originalname);

    // Arquivo primeiro, metadado depois: se o banco falhar, remove o arquivo
    // (melhor esforço) para não deixar lixo órfão no storage.
    await this.storage.salvar(chave, arquivo.buffer);
    try {
      return await this.tenantPrisma.transaction(async (tx) => {
        const anexo = await tx.anexo.create({
          data: {
            tituloId,
            url: chave,
            nomeArquivo,
            tipoMime: arquivo.mimetype,
            tamanhoBytes: arquivo.size,
            enviadoPor: this.tenantPrisma.userId,
          },
          select: ANEXO_PUBLICO,
        });
        await this.audit.registrar(
          {
            entidade: "Anexo",
            entidadeId: anexo.id,
            acao: "CREATE",
            depois: { tituloId, nomeArquivo, tipoMime: arquivo.mimetype, tamanhoBytes: arquivo.size },
          },
          tx,
        );
        return anexo;
      });
    } catch (erro) {
      await this.storage.remover(chave);
      throw erro;
    }
  }

  async listar(tituloId: string) {
    const titulo = await this.tenantPrisma.client.titulo.findUnique({ where: { id: tituloId } });
    if (!titulo) {
      throw new NotFoundException("Título não encontrado.");
    }
    return this.tenantPrisma.client.anexo.findMany({
      where: { tituloId },
      select: ANEXO_PUBLICO,
      orderBy: { createdAt: "asc" },
    });
  }

  async baixar(anexoId: string) {
    const anexo = await this.tenantPrisma.client.anexo.findUnique({ where: { id: anexoId } });
    if (!anexo) {
      throw new NotFoundException("Anexo não encontrado.");
    }
    return { anexo, conteudo: await this.storage.ler(anexo.url) };
  }

  async remover(anexoId: string): Promise<void> {
    const anexo = await this.tenantPrisma.client.anexo.findUnique({ where: { id: anexoId } });
    if (!anexo) {
      throw new NotFoundException("Anexo não encontrado.");
    }

    await this.tenantPrisma.transaction(async (tx) => {
      await tx.anexo.delete({ where: { id: anexoId } });
      await this.audit.registrar(
        {
          entidade: "Anexo",
          entidadeId: anexoId,
          acao: "DELETE",
          antes: {
            tituloId: anexo.tituloId,
            nomeArquivo: anexo.nomeArquivo,
            tipoMime: anexo.tipoMime,
            tamanhoBytes: anexo.tamanhoBytes,
          },
        },
        tx,
      );
    });
    // Só depois do commit: se a remoção do arquivo falhar sobra um órfão no
    // storage (inofensivo), nunca um metadado apontando pra arquivo inexistente.
    await this.storage.remover(anexo.url);
  }
}

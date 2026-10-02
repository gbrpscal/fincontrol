import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AnexosService, type ArquivoRecebido } from "./anexos.service";
import { TAMANHO_MAXIMO_ANEXO } from "./tipos-permitidos";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnexosController {
  constructor(private readonly anexos: AnexosService) {}

  @Post("titulos/:tituloId/anexos")
  @Roles("OWNER", "FINANCEIRO")
  @UseInterceptors(FileInterceptor("arquivo", { limits: { fileSize: TAMANHO_MAXIMO_ANEXO, files: 1 } }))
  enviar(@Param("tituloId") tituloId: string, @UploadedFile() arquivo: ArquivoRecebido | undefined) {
    if (!arquivo) {
      throw new BadRequestException('Envie o arquivo no campo multipart "arquivo".');
    }
    return this.anexos.enviar(tituloId, arquivo);
  }

  @Get("titulos/:tituloId/anexos")
  listar(@Param("tituloId") tituloId: string) {
    return this.anexos.listar(tituloId);
  }

  @Get("anexos/:id/download")
  async baixar(@Param("id") id: string): Promise<StreamableFile> {
    const { anexo, conteudo } = await this.anexos.baixar(id);
    return new StreamableFile(conteudo, {
      type: anexo.tipoMime,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nomeArquivo)}`,
    });
  }

  @Delete("anexos/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("OWNER", "FINANCEIRO")
  async remover(@Param("id") id: string): Promise<void> {
    await this.anexos.remover(id);
  }
}

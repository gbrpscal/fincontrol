import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AtualizarTituloDto, CriarTituloDto, ListarTitulosQueryDto } from "../dto/financeiro.dto";
import { TitulosService } from "./titulos.service";

@Controller("titulos")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TitulosController {
  constructor(private readonly titulos: TitulosService) {}

  @Get()
  listar(@Query() filtro: ListarTitulosQueryDto) {
    return this.titulos.listar(filtro);
  }

  @Get(":id")
  obter(@Param("id") id: string) {
    return this.titulos.obter(id);
  }

  @Post()
  @Roles("OWNER", "FINANCEIRO")
  criar(@Body() dto: CriarTituloDto) {
    return this.titulos.criar(dto);
  }

  @Patch(":id")
  @Roles("OWNER", "FINANCEIRO")
  atualizar(@Param("id") id: string, @Body() dto: AtualizarTituloDto) {
    return this.titulos.atualizar(id, dto);
  }

  @Post(":id/cancelar")
  @HttpCode(HttpStatus.OK)
  @Roles("OWNER", "FINANCEIRO")
  cancelar(@Param("id") id: string) {
    return this.titulos.cancelar(id);
  }
}

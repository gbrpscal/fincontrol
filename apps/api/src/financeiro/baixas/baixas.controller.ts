import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { RegistrarBaixaDto } from "../dto/financeiro.dto";
import { BaixasService } from "./baixas.service";

@Controller("titulos/:tituloId/baixas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BaixasController {
  constructor(private readonly baixas: BaixasService) {}

  @Post()
  @Roles("OWNER", "FINANCEIRO")
  registrar(@Param("tituloId") tituloId: string, @Body() dto: RegistrarBaixaDto) {
    return this.baixas.registrar(tituloId, dto);
  }
}

import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { CriarCentroCustoDto } from "../dto/cadastros.dto";
import { CentrosCustoService } from "./centros-custo.service";

@Controller("centros-custo")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CentrosCustoController {
  constructor(private readonly centrosCusto: CentrosCustoService) {}

  @Get()
  listar() {
    return this.centrosCusto.listar();
  }

  @Post()
  @Roles("OWNER", "FINANCEIRO")
  criar(@Body() dto: CriarCentroCustoDto) {
    return this.centrosCusto.criar(dto);
  }
}

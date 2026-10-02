import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import {
  ListarEstornosQueryDto,
  RejeitarEstornoDto,
  SolicitarEstornoDto,
} from "../dto/financeiro.dto";
import { EstornosService } from "./estornos.service";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstornosController {
  constructor(private readonly estornos: EstornosService) {}

  @Get("estornos")
  listar(@Query() filtro: ListarEstornosQueryDto) {
    return this.estornos.listar(filtro);
  }

  @Post("baixas/:baixaId/estorno")
  @Roles("OWNER", "FINANCEIRO")
  solicitar(@Param("baixaId") baixaId: string, @Body() dto: SolicitarEstornoDto) {
    return this.estornos.solicitar(baixaId, dto);
  }

  @Post("estornos/:id/aprovar")
  @HttpCode(HttpStatus.OK)
  @Roles("OWNER", "FINANCEIRO")
  aprovar(@Param("id") id: string) {
    return this.estornos.aprovar(id);
  }

  @Post("estornos/:id/rejeitar")
  @HttpCode(HttpStatus.OK)
  @Roles("OWNER", "FINANCEIRO")
  rejeitar(@Param("id") id: string, @Body() dto: RejeitarEstornoDto) {
    return this.estornos.rejeitar(id, dto);
  }
}

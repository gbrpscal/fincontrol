import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { CriarContaBancariaManualDto } from "../dto/cadastros.dto";
import { ContasBancariasService } from "./contas-bancarias.service";

@Controller("contas-bancarias")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContasBancariasController {
  constructor(private readonly contasBancarias: ContasBancariasService) {}

  @Get()
  listar() {
    return this.contasBancarias.listar();
  }

  @Post()
  @Roles("OWNER", "FINANCEIRO")
  criar(@Body() dto: CriarContaBancariaManualDto) {
    return this.contasBancarias.criar(dto);
  }
}

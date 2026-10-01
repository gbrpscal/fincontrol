import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { CriarClienteFornecedorDto } from "../dto/cadastros.dto";
import { ClientesFornecedoresService } from "./clientes-fornecedores.service";

@Controller("clientes-fornecedores")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientesFornecedoresController {
  constructor(private readonly clientesFornecedores: ClientesFornecedoresService) {}

  @Get()
  listar() {
    return this.clientesFornecedores.listar();
  }

  @Post()
  @Roles("OWNER", "FINANCEIRO")
  criar(@Body() dto: CriarClienteFornecedorDto) {
    return this.clientesFornecedores.criar(dto);
  }
}

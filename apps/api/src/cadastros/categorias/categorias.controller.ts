import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { Roles } from "../../auth/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import { AtualizarCategoriaDto, CriarCategoriaDto } from "../dto/cadastros.dto";
import { CategoriasService } from "./categorias.service";

@Controller("categorias")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  @Get()
  listar() {
    return this.categorias.listar();
  }

  @Post()
  @Roles("OWNER", "FINANCEIRO")
  criar(@Body() dto: CriarCategoriaDto) {
    return this.categorias.criar(dto);
  }

  @Patch(":id")
  @Roles("OWNER", "FINANCEIRO")
  atualizar(@Param("id") id: string, @Body() dto: AtualizarCategoriaDto) {
    return this.categorias.atualizar(id, dto);
  }
}

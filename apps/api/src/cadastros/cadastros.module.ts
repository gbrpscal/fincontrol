import { Module } from "@nestjs/common";
import { CategoriasController } from "./categorias/categorias.controller";
import { CategoriasService } from "./categorias/categorias.service";
import { CentrosCustoController } from "./centros-custo/centros-custo.controller";
import { CentrosCustoService } from "./centros-custo/centros-custo.service";
import { ClientesFornecedoresController } from "./clientes-fornecedores/clientes-fornecedores.controller";
import { ClientesFornecedoresService } from "./clientes-fornecedores/clientes-fornecedores.service";
import { ContasBancariasController } from "./contas-bancarias/contas-bancarias.controller";
import { ContasBancariasService } from "./contas-bancarias/contas-bancarias.service";

@Module({
  controllers: [
    CategoriasController,
    CentrosCustoController,
    ClientesFornecedoresController,
    ContasBancariasController,
  ],
  providers: [
    CategoriasService,
    CentrosCustoService,
    ClientesFornecedoresService,
    ContasBancariasService,
  ],
})
export class CadastrosModule {}

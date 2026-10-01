import {
  atualizarCategoriaSchema,
  criarCategoriaSchema,
  criarCentroCustoSchema,
  criarClienteFornecedorSchema,
  criarContaBancariaManualSchema,
} from "@fincontrol/shared";
import { createZodDto } from "nestjs-zod";

export class CriarCategoriaDto extends createZodDto(criarCategoriaSchema) {}
export class AtualizarCategoriaDto extends createZodDto(atualizarCategoriaSchema) {}
export class CriarCentroCustoDto extends createZodDto(criarCentroCustoSchema) {}
export class CriarClienteFornecedorDto extends createZodDto(criarClienteFornecedorSchema) {}
export class CriarContaBancariaManualDto extends createZodDto(criarContaBancariaManualSchema) {}

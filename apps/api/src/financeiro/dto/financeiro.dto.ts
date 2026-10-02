import {
  atualizarTituloSchema,
  criarTituloSchema,
  listarEstornosQuerySchema,
  listarTitulosQuerySchema,
  registrarBaixaSchema,
  rejeitarEstornoSchema,
  solicitarEstornoSchema,
} from "@fincontrol/shared";
import { createZodDto } from "nestjs-zod";

export class CriarTituloDto extends createZodDto(criarTituloSchema) {}
export class AtualizarTituloDto extends createZodDto(atualizarTituloSchema) {}
export class ListarTitulosQueryDto extends createZodDto(listarTitulosQuerySchema) {}
export class RegistrarBaixaDto extends createZodDto(registrarBaixaSchema) {}
export class SolicitarEstornoDto extends createZodDto(solicitarEstornoSchema) {}
export class RejeitarEstornoDto extends createZodDto(rejeitarEstornoSchema) {}
export class ListarEstornosQueryDto extends createZodDto(listarEstornosQuerySchema) {}

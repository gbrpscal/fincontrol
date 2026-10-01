import {
  loginComEmpresaSchema,
  loginSchema,
  refreshSchema,
  registrarSchema,
} from "@fincontrol/shared";
import { createZodDto } from "nestjs-zod";

// createZodDto gera uma classe utilizável como DTO do NestJS (validação +
// tipo) a partir do schema Zod que já é a fonte de verdade em
// @fincontrol/shared — não duplicamos a regra de validação aqui.
export class RegistrarDto extends createZodDto(registrarSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class LoginComEmpresaDto extends createZodDto(loginComEmpresaSchema) {}
export class RefreshDto extends createZodDto(refreshSchema) {}

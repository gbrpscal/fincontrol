import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import {
  LoginComEmpresaDto,
  LoginDto,
  RefreshDto,
  RegistrarDto,
} from "./dto/auth.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthenticatedUser } from "./types";

function dispositivoDoRequest(req: Request) {
  return {
    deviceLabel: req.headers["user-agent"]?.slice(0, 255) ?? "Dispositivo desconhecido",
    ip: req.ip ?? null,
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("registrar")
  registrar(@Body() dto: RegistrarDto, @Req() req: Request) {
    return this.auth.registrar(dto, dispositivoDoRequest(req));
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, dispositivoDoRequest(req));
  }

  @Post("login/empresa")
  @HttpCode(HttpStatus.OK)
  loginComEmpresa(@Body() dto: LoginComEmpresaDto, @Req() req: Request) {
    return this.auth.loginComEmpresa(dto, dispositivoDoRequest(req));
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto, dispositivoDoRequest(req));
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get("sessoes")
  @UseGuards(JwtAuthGuard)
  listarSessoes(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listarSessoes(user.sub, user.sessionId);
  }

  @Delete("sessoes/:id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revogarSessao(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<void> {
    await this.auth.revogarSessao(user.sub, id);
  }
}

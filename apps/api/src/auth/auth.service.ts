import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  LoginComEmpresaInput,
  LoginInput,
  RefreshInput,
  RegistrarInput,
  Sessao,
  Tokens,
} from "@fincontrol/shared";
import type { MembershipRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

interface DispositivoInfo {
  deviceLabel: string;
  ip: string | null;
}

interface EmitirTokensParams extends DispositivoInfo {
  userId: string;
  membershipId: string;
  empresaId: string;
  empresaNome: string;
  role: MembershipRole;
}

export interface LoginResultadoSelecao {
  requerSelecaoEmpresa: true;
  empresas: Array<{ id: string; nome: string; role: MembershipRole }>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async registrar(input: RegistrarInput, dispositivo: DispositivoInfo): Promise<Tokens> {
    const emailExistente = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (emailExistente) {
      throw new ConflictException("Já existe uma conta com este e-mail.");
    }

    const senhaHash = await this.password.hash(input.senha);

    const criado = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { nome: input.nome, email: input.email, senhaHash },
      });
      const empresa = await tx.empresa.create({
        data: { nome: input.empresaNome, documento: input.empresaDocumento },
      });
      const membership = await tx.membership.create({
        data: { userId: user.id, empresaId: empresa.id, role: "OWNER" },
      });
      return { user, empresa, membership };
    });

    return this.emitirTokens({
      userId: criado.user.id,
      membershipId: criado.membership.id,
      empresaId: criado.empresa.id,
      empresaNome: criado.empresa.nome,
      role: criado.membership.role,
      ...dispositivo,
    });
  }

  async login(
    input: LoginInput,
    dispositivo: DispositivoInfo,
  ): Promise<Tokens | LoginResultadoSelecao> {
    const user = await this.autenticar(input.email, input.senha);

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, ativo: true },
      include: { empresa: true },
    });

    if (memberships.length === 0) {
      throw new ForbiddenException("Usuário sem nenhuma empresa ativa vinculada.");
    }

    if (memberships.length > 1) {
      return {
        requerSelecaoEmpresa: true,
        empresas: memberships.map((m) => ({ id: m.empresaId, nome: m.empresa.nome, role: m.role })),
      };
    }

    const membership = memberships[0]!;
    return this.emitirTokens({
      userId: user.id,
      membershipId: membership.id,
      empresaId: membership.empresaId,
      empresaNome: membership.empresa.nome,
      role: membership.role,
      ...dispositivo,
    });
  }

  async loginComEmpresa(input: LoginComEmpresaInput, dispositivo: DispositivoInfo): Promise<Tokens> {
    const user = await this.autenticar(input.email, input.senha);

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, empresaId: input.empresaId, ativo: true },
      include: { empresa: true },
    });
    if (!membership) {
      throw new ForbiddenException("Usuário não pertence a esta empresa.");
    }

    return this.emitirTokens({
      userId: user.id,
      membershipId: membership.id,
      empresaId: membership.empresaId,
      empresaNome: membership.empresa.nome,
      role: membership.role,
      ...dispositivo,
    });
  }

  async refresh(input: RefreshInput, dispositivo: DispositivoInfo): Promise<Tokens> {
    const hash = this.tokens.hashRefreshToken(input.refreshToken);
    const sessao = await this.prisma.refreshSession.findUnique({
      where: { refreshTokenHash: hash },
      include: { activeMembership: { include: { empresa: true } } },
    });

    if (!sessao || sessao.revogadoEm || sessao.expiraEm < new Date()) {
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    }

    // Rotação: o refresh token é de uso único — a sessão usada é revogada e
    // uma nova é criada, mantendo o mesmo contexto de empresa/papel.
    await this.prisma.refreshSession.update({
      where: { id: sessao.id },
      data: { revogadoEm: new Date() },
    });

    return this.emitirTokens({
      userId: sessao.userId,
      membershipId: sessao.activeMembershipId,
      empresaId: sessao.activeMembership.empresaId,
      empresaNome: sessao.activeMembership.empresa.nome,
      role: sessao.activeMembership.role,
      ...dispositivo,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { refreshTokenHash: hash, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }

  async listarSessoes(userId: string, sessionIdAtual: string): Promise<Sessao[]> {
    const sessoes = await this.prisma.refreshSession.findMany({
      where: { userId, revogadoEm: null, expiraEm: { gt: new Date() } },
      include: { activeMembership: { include: { empresa: true } } },
      orderBy: { criadoEm: "desc" },
    });

    return sessoes.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      empresaNome: s.activeMembership.empresa.nome,
      criadoEm: s.criadoEm.toISOString(),
      expiraEm: s.expiraEm.toISOString(),
      atual: s.id === sessionIdAtual,
    }));
  }

  async revogarSessao(userId: string, sessionId: string): Promise<void> {
    const sessao = await this.prisma.refreshSession.findUnique({ where: { id: sessionId } });
    // Nunca confiar no :id da URL sozinho — sempre confirmar que a sessão é
    // do próprio usuário autenticado antes de revogar.
    if (!sessao || sessao.userId !== userId) {
      throw new NotFoundException("Sessão não encontrada.");
    }
    await this.prisma.refreshSession.update({
      where: { id: sessionId },
      data: { revogadoEm: new Date() },
    });
  }

  private async autenticar(email: string, senha: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }
    const senhaOk = await this.password.compare(senha, user.senhaHash);
    if (!senhaOk) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }
    return user;
  }

  private async emitirTokens(params: EmitirTokensParams): Promise<Tokens> {
    const { token: refreshToken, hash, expiraEm } = this.tokens.generateRefreshToken();

    const sessao = await this.prisma.refreshSession.create({
      data: {
        userId: params.userId,
        activeMembershipId: params.membershipId,
        refreshTokenHash: hash,
        deviceLabel: params.deviceLabel,
        ip: params.ip,
        expiraEm,
      },
    });

    const accessToken = this.tokens.signAccessToken({
      sub: params.userId,
      membershipId: params.membershipId,
      empresaId: params.empresaId,
      role: params.role,
      sessionId: sessao.id,
    });

    return {
      accessToken,
      refreshToken,
      empresa: { id: params.empresaId, nome: params.empresaNome, role: params.role },
    };
  }
}

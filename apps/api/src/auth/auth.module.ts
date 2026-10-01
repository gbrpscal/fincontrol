import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAccessStrategy } from "./jwt-access.strategy";
import { PasswordService } from "./password.service";
import { RolesGuard } from "./roles.guard";
import { TokenService } from "./token.service";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtAccessStrategy, RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}

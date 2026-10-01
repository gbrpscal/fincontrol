import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  hash(senha: string): Promise<string> {
    return bcrypt.hash(senha, SALT_ROUNDS);
  }

  compare(senha: string, hash: string): Promise<boolean> {
    return bcrypt.compare(senha, hash);
  }
}

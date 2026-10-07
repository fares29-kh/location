import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

const HASH_OPTIONS = { type: argon2.argon2id } as const;

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Vérification factice quand le compte n'existe pas : le temps de réponse reste le même,
   * ce qui empêche de deviner quels téléphones ou emails sont inscrits.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= argon2.hash('drivetn-dummy-password', HASH_OPTIONS);
    await this.verify(await this.dummyHash, password);
    return false;
  }
}

import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';

const HASH_OPTIONS = { algorithm: Algorithm.Argon2id } as const;

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, HASH_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /**
   * Vérification factice quand le compte n'existe pas : le temps de réponse reste le même,
   * ce qui empêche de deviner quels téléphones ou emails sont inscrits.
   */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= hash('drivetn-dummy-password', HASH_OPTIONS);
    await this.verify(await this.dummyHash, password);
    return false;
  }
}

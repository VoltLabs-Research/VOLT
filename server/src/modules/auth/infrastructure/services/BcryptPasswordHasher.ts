
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import { Singleton } from '@shared/infrastructure/di/decorators';
import bcrypt from 'bcryptjs';

@Singleton()
export default class BcryptPasswordHasher implements IPasswordHasher {
    private readonly saltRounds = 12;

    public async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.saltRounds);
    }

    public async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}

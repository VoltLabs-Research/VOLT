import { injectable } from 'tsyringe';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import bcrypt from 'bcryptjs';

@injectable()
export default class BcryptPasswordHasher implements IPasswordHasher {
    private readonly saltRounds: number;

    constructor(saltRounds: number = 12) {
        this.saltRounds = saltRounds;
    }

    public async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.saltRounds);
    }

    public async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}

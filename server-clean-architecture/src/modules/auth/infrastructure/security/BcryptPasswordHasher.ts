import bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { injectable } from 'tsyringe';

@injectable()
export default class BcryptPasswordHasher implements IPasswordHasher{
    private readonly saltRounds: number;

    constructor(saltRounds: number = 12){
        this.saltRounds = saltRounds;
    }
    
    public async hash(password: string): Promise<string>{
        return bcrypt.hash(password, this.saltRounds);
    }

    public async compare(password: string, hash: string): Promise<boolean>{
        return bcrypt.compare(password, hash);
    }
};
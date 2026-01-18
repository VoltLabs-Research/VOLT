import jwt, { Secret } from 'jsonwebtoken';
import { ITokenService, TokenPayload } from '@modules/auth/domain/ports/ITokenService';
import { injectable } from 'tsyringe';

@injectable()
export default class JwtTokenService implements ITokenService {
    private readonly secret: Secret = process.env.SECRET_KEY || 'default_secret';
    private readonly expiresIn: string = process.env.JWT_EXPIRE || '7d';

    constructor(){}

    public sign(id: string): string {
        return jwt.sign({ id }, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
    }

    public verify(token: string): TokenPayload | null {
        try {
            const decoded = jwt.verify(token, this.secret) as TokenPayload;
            return decoded;
        } catch {
            return null;
        }
    }
};
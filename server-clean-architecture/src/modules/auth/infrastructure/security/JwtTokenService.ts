import jwt, { Secret } from 'jsonwebtoken';
import { ITokenService, TokenPayload } from '../../domain/ports/ITokenService';

export default class JwtTokenService implements ITokenService{
    constructor(
        private readonly secret: Secret,
        private readonly expiresIn?: number
    ){}

    public sign(id: string): string{
        return jwt.sign({ id }, this.secret, { expiresIn: this.expiresIn });
    }

    public verify(token: string): TokenPayload | null{
        try{
            const decoded = jwt.verify(token, this.secret) as TokenPayload;
            return decoded;
        }catch{
            return null;
        }
    }
};
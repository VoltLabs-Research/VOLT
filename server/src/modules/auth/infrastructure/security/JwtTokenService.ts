import jwt, { Secret } from 'jsonwebtoken';
import { ITokenService, TokenPayload } from '@modules/auth/domain/port/ITokenService';
import { injectable } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';

const getSecretKey = (): Secret => {
    const key = process.env.SECRET_KEY;
    if (!key) {
        throw new Error(ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    return key;
};

@injectable()
export default class JwtTokenService implements ITokenService {
    private readonly secret: Secret = getSecretKey();
    private readonly expiresIn: string = process.env.JWT_EXPIRE || '7d';

    public sign(userId: string): string {
        return jwt.sign({
            _id: userId,
            userId,
            id: userId
        }, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
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

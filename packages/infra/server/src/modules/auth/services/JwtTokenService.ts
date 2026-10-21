import { ErrorCodes } from '@core/constants/error-codes';
import { parseJwtTtlSeconds, signJwt, verifyJwt } from '@shared/utilities/jwt';

interface TokenPayload {
    id: string;
    iat?: number;
    exp?: number;
}

const isTokenPayload = (value: unknown): value is TokenPayload => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return 'id' in value
        && typeof value.id === 'string';
};

const getSecretKey = (): string => {
    const key = process.env.SECRET_KEY;
    if (!key) {
        throw new Error(ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    return key;
};

class JwtTokenService {
    private readonly secret = getSecretKey();
    private readonly ttlSeconds = parseJwtTtlSeconds(process.env.JWT_EXPIRE, '7d');

    public sign(userId: string): Promise<string> {
        return signJwt({
            id: userId,
            jti: globalThis.crypto.randomUUID()
        }, this.secret, this.ttlSeconds);
    }

    public async verify(token: string): Promise<TokenPayload | null> {
        const decoded = await verifyJwt(token, this.secret);
        return isTokenPayload(decoded) ? decoded : null;
    }
}

export default new JwtTokenService();

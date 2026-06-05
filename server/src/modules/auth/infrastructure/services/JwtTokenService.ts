import { ErrorCodes } from '@core/constants/error-codes';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { ITokenService, TokenPayload } from '@modules/auth/domain/port/ITokenService';
import type { Secret, SignOptions } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';

const isStringValue = (value: string): value is StringValue => {
    return /^\d+(?:\.\d+)?(?:\s?(?:years?|yrs?|y|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|milliseconds?|msecs?|ms))?$/i.test(value);
};

const isTokenPayload = (value: unknown): value is TokenPayload => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return '_id' in value
        && 'userId' in value
        && 'id' in value
        && typeof value._id === 'string'
        && typeof value.userId === 'string'
        && typeof value.id === 'string';
};

const getExpiresIn = (): SignOptions['expiresIn'] => {
    const value = process.env.JWT_EXPIRE;
    if (!value) {
        return '7d';
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return '7d';
    }

    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue) && String(numericValue) === trimmedValue) {
        return numericValue;
    }

    if (isStringValue(trimmedValue)) {
        return trimmedValue;
    }

    return '7d';
};

const getSecretKey = (): Secret => {
    const key = process.env.SECRET_KEY;
    if (!key) {
        throw new Error(ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    return key;
};

@Singleton(AUTH_TOKENS.TokenService)
export default class JwtTokenService implements ITokenService {
    private readonly secret: Secret = getSecretKey();
    private readonly expiresIn = getExpiresIn();

    public sign(userId: string): string {
        const signOptions: SignOptions = {
            expiresIn: this.expiresIn
        };

        return jwt.sign({
            _id: userId,
            userId,
            id: userId
        }, this.secret, signOptions);
    }

    public verify(token: string): TokenPayload | null {
        try {
            const decoded = jwt.verify(token, this.secret);
            if (!isTokenPayload(decoded)) {
                return null;
            }

            return decoded;
        } catch {
            return null;
        }
    }
}

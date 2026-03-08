import OAuthLoginUseCase from '@modules/auth/application/use-cases/OAuthLoginUseCase';
import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { ErrorCodes } from '@core/constants/error-codes';

interface OAuthMappedProfile {
    email?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
}

interface OAuthProfileMapper {
    map(profile: any): OAuthMappedProfile;
}

interface OAuthStrategyFailure {
    code: string;
    message: string;
    statusCode?: number;
}

type OAuthDone = (error: unknown, user?: false | AuthenticatedRequest['user'], info?: OAuthStrategyFailure) => void;

const CANONICAL_ERROR_CODES = new Set<string>(Object.values(ErrorCodes));

const normalizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
        return undefined;
    }

    return normalizedValue;
};

const getCanonicalErrorCode = (value: unknown): string => {
    if (typeof value !== 'string') {
        return ErrorCodes.OAUTH_STRATEGY_ERROR;
    }

    if (!CANONICAL_ERROR_CODES.has(value)) {
        return ErrorCodes.OAUTH_STRATEGY_ERROR;
    }

    return value;
};

const toOAuthFailure = (code?: unknown, statusCode?: number): OAuthStrategyFailure => {
    const normalizedCode = getCanonicalErrorCode(code);

    return {
        code: normalizedCode,
        message: normalizedCode,
        ...(typeof statusCode === 'number'
            ? { statusCode }
            : {})
    };
};

export default abstract class BaseOAuthStrategy {
    constructor(
        protected readonly provider: OAuthProvider,
        protected readonly oauthLoginUseCase: OAuthLoginUseCase,
        protected readonly mapper: OAuthProfileMapper
    ) {}

    protected async verify(req: AuthenticatedRequest, _accessToken: string, _refreshToken: string, profile: any, done: OAuthDone): Promise<void> {
        try {
            const mappedProfile = this.mapper.map(profile);
            const email = normalizeOptionalString(mappedProfile.email);

            if (!email) {
                done(null, false, toOAuthFailure());
                return;
            }

            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            const result = await this.oauthLoginUseCase.execute({
                email: email.toLowerCase(),
                firstName: normalizeOptionalString(mappedProfile.firstName),
                lastName: normalizeOptionalString(mappedProfile.lastName),
                avatar: normalizeOptionalString(mappedProfile.avatar),
                oauthProvider: this.provider,
                oauthId: profile.id,
                ip,
                userAgent
            });

            if (!result.success) {
                done(null, false, toOAuthFailure(result.error.code, result.error.statusCode));
                return;
            }

            const { user, token } = result.value;
            req.user = user;
            req.token = token;

            done(null, user);
        } catch {
            done(null, false, toOAuthFailure());
        }
    }
}

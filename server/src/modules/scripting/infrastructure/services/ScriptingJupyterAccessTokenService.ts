
import type { IScriptingJupyterAccessTokenService } from '@modules/scripting/domain/port/IScriptingJupyterAccessTokenService';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import ms from 'ms';
import type { StringValue } from 'ms';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface ScriptingJupyterAccessTokenClaims extends JwtPayload {
    type: 'scripting-jupyter';
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

export interface CreateScriptingJupyterAccessTokenInput {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

export interface VerifiedScriptingJupyterAccessToken {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

const DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_TTL = '7d' as const;
const DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_MAX_AGE_MS = ms(DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_TTL);

const isStringValue = (value: string): value is StringValue => {
    return /^\d+(?:\.\d+)?(?:\s?(?:years?|yrs?|y|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|milliseconds?|msecs?|ms))?$/i.test(value);
};

const getSecretKey = (): Secret => {
    const key = process.env.SECRET_KEY;
    if (!key) {
        throw new Error('SECRET_KEY is required');
    }

    return key;
};

const isClaimsPayload = (value: unknown): value is ScriptingJupyterAccessTokenClaims => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const payload = value as Record<string, unknown>;
    return payload.type === 'scripting-jupyter'
        && typeof payload.teamId === 'string'
        && typeof payload.runtimeNotebookId === 'string'
        && typeof payload.userId === 'string';
};

const resolveExpiresIn = (): SignOptions['expiresIn'] => {
    const value = process.env.SCRIPTING_JUPYTER_PROXY_ACCESS_TOKEN_TTL;
    if (!value) {
        return DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_TTL;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_TTL;
    }

    const numericValue = Number(trimmedValue);
    if (Number.isFinite(numericValue) && String(numericValue) === trimmedValue) {
        return numericValue;
    }

    if (isStringValue(trimmedValue)) {
        return trimmedValue;
    }

    return DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_TTL;
};

const resolveCookieMaxAgeMs = (expiresIn: SignOptions['expiresIn']): number => {
    if (typeof expiresIn === 'number') {
        return expiresIn * 1000;
    }

    if (!expiresIn) {
        return DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_MAX_AGE_MS;
    }

    const parsedDuration = ms(expiresIn);
    return typeof parsedDuration === 'number' && Number.isFinite(parsedDuration)
        ? parsedDuration
        : DEFAULT_SCRIPTING_JUPYTER_ACCESS_TOKEN_MAX_AGE_MS;
};

@Singleton(SCRIPTING_TOKENS.ScriptingJupyterAccessTokenService)
export class ScriptingJupyterAccessTokenService implements IScriptingJupyterAccessTokenService {
    private readonly expiresIn = resolveExpiresIn();
    private readonly cookieMaxAgeMs = resolveCookieMaxAgeMs(this.expiresIn);
    private readonly secret = getSecretKey();
    private readonly signOptions: SignOptions = {
        expiresIn: this.expiresIn
    };

    create(input: CreateScriptingJupyterAccessTokenInput): string {
        return jwt.sign({
            type: 'scripting-jupyter',
            teamId: input.teamId,
            runtimeNotebookId: input.runtimeNotebookId,
            userId: input.userId
        }, this.secret, this.signOptions);
    }

    getCookieMaxAgeMs(): number {
        return this.cookieMaxAgeMs;
    }

    verify(token: string): VerifiedScriptingJupyterAccessToken | null {
        try {
            const decoded = jwt.verify(token, this.secret);
            if (!isClaimsPayload(decoded)) {
                return null;
            }

            return {
                teamId: decoded.teamId,
                runtimeNotebookId: decoded.runtimeNotebookId,
                userId: decoded.userId
            };
        } catch {
            return null;
        }
    }
}

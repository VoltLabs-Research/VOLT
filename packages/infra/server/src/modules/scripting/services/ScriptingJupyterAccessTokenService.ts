import { parseJwtTtlSeconds, signJwt, verifyJwt } from '@shared/utilities/jwt';
import type { ScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';

interface ScriptingJupyterAccessTokenClaims {
    type: 'scripting-jupyter';
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

interface CreateScriptingJupyterAccessTokenInput {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

interface VerifiedScriptingJupyterAccessToken {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

const getSecretKey = (): string => {
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

export class ScriptingJupyterAccessTokenService {
    private readonly ttlSeconds = parseJwtTtlSeconds(process.env.SCRIPTING_JUPYTER_PROXY_ACCESS_TOKEN_TTL, '7d');
    private readonly secret = getSecretKey();

    private create(input: CreateScriptingJupyterAccessTokenInput): Promise<string> {
        return signJwt({
            type: 'scripting-jupyter',
            teamId: input.teamId,
            runtimeNotebookId: input.runtimeNotebookId,
            userId: input.userId
        }, this.secret, this.ttlSeconds);
    }

    async createAccessGrant(input: CreateScriptingJupyterAccessTokenInput): Promise<ScriptingJupyterAccessGrant> {
        return {
            token: await this.create(input),
            teamId: input.teamId,
            runtimeNotebookId: input.runtimeNotebookId,
            maxAgeMs: this.ttlSeconds * 1000
        };
    }

    async verify(token: string): Promise<VerifiedScriptingJupyterAccessToken | null> {
        const decoded = await verifyJwt(token, this.secret);
        if (!isClaimsPayload(decoded)) {
            return null;
        }

        return {
            teamId: decoded.teamId,
            runtimeNotebookId: decoded.runtimeNotebookId,
            userId: decoded.userId
        };
    }
}

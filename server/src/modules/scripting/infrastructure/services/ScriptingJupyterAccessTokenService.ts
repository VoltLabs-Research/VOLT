import { injectable } from 'tsyringe';
import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

interface ScriptingJupyterAccessTokenClaims extends JwtPayload {
    type: 'scripting-jupyter';
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
};

export interface CreateScriptingJupyterAccessTokenInput {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
};

export interface VerifiedScriptingJupyterAccessToken {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
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

@injectable()
export class ScriptingJupyterAccessTokenService {
    private readonly secret = getSecretKey();
    private readonly signOptions: SignOptions = {
        expiresIn: '10m'
    };

    create(input: CreateScriptingJupyterAccessTokenInput): string {
        return jwt.sign({
            type: 'scripting-jupyter',
            teamId: input.teamId,
            runtimeNotebookId: input.runtimeNotebookId,
            userId: input.userId
        }, this.secret, this.signOptions);
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
};

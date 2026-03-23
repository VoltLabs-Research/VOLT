import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import jwt from 'jsonwebtoken';
import { injectable } from 'tsyringe';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

interface BinaryRelayTokenSignOptions extends SignOptions {
    expiresIn: number;
}

interface BinaryRelayTokenClaims extends JwtPayload {
    type: 'team-cluster-binary-relay';
    relaySessionId: string;
    teamClusterId: string;
    sessionId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    relayProtocolVersion: 1;
}

export interface BinaryRelayTokenContext {
    relaySessionId: string;
    teamClusterId: string;
    sessionId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export interface VerifiedBinaryRelayToken extends BinaryRelayTokenContext {
    relayProtocolVersion: 1;
}

const DEFAULT_BINARY_RELAY_TOKEN_TTL_MS = 60_000;

const getSecretKey = (): Secret => {
    const key = process.env.SECRET_KEY?.trim();
    if (!key) {
        throw new Error('SECRET_KEY is required');
    }

    return key;
};

const isClaimsPayload = (value: unknown): value is BinaryRelayTokenClaims => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const payload = value as Record<string, unknown>;
    return payload.type === 'team-cluster-binary-relay'
        && typeof payload.relaySessionId === 'string'
        && typeof payload.teamClusterId === 'string'
        && typeof payload.sessionId === 'string'
        && Object.values(TeamClusterServiceExposureAccessMode).some((accessMode) => accessMode === payload.accessMode)
        && payload.relayProtocolVersion === 1;
};

@injectable()
export class BinaryRelayTokenService {
    private readonly secret = getSecretKey();
    private readonly signOptions: BinaryRelayTokenSignOptions = {
        expiresIn: Math.ceil(
            readNumberEnv(
                'TEAM_CLUSTER_BINARY_RELAY_TOKEN_TTL_MS',
                DEFAULT_BINARY_RELAY_TOKEN_TTL_MS
            ) / 1000
        )
    };

    create(input: BinaryRelayTokenContext): string {
        return jwt.sign({
            type: 'team-cluster-binary-relay',
            relaySessionId: input.relaySessionId,
            teamClusterId: input.teamClusterId,
            sessionId: input.sessionId,
            accessMode: input.accessMode,
            relayProtocolVersion: 1
        }, this.secret, this.signOptions);
    }

    verify(token: string): VerifiedBinaryRelayToken | null {
        try {
            const decoded = jwt.verify(token, this.secret);
            if (!isClaimsPayload(decoded)) {
                return null;
            }

            return {
                relaySessionId: decoded.relaySessionId,
                teamClusterId: decoded.teamClusterId,
                sessionId: decoded.sessionId,
                accessMode: decoded.accessMode,
                relayProtocolVersion: 1
            };
        } catch {
            return null;
        }
    }
}

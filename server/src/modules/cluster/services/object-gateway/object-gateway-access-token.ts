import { ErrorCodes } from '@core/constants/error-codes';

import { findTeamClusterByIdWithSensitiveData } from '@modules/cluster/contracts/team-cluster';
import DaemonCredentialGuard from '@modules/cluster/services/daemon/DaemonCredentialGuard';
import {
    OBJECT_GATEWAY_EXPOSURE_ID,
    OBJECT_GATEWAY_EXPOSURE_NAME
} from '@modules/cluster/services/object-gateway/object-gateway-paths';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/TeamClusterExposure';
import jwt from 'jsonwebtoken';

interface TeamClusterDirectAccessTokenClaims {
    requesterKind: 'daemon' | 'server';
    requesterId: string;
    ownerClusterId: string;
    teamId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    iat: number;
    exp: number;
}

export interface ObjectGatewayAccessToken {
    token: string;
    expiresAt: string;
}

const TOKEN_TTL_SECONDS = 5 * 60;
const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 5_000;

export default class ObjectGatewayAccessTokenProvider {
    private readonly cachedTokens = new Map<string, ObjectGatewayAccessToken>();
    private readonly pendingTokens = new Map<string, Promise<ObjectGatewayAccessToken>>();
    private readonly daemonCredentialGuard = new DaemonCredentialGuard();

    async resolve(teamClusterId: string): Promise<ObjectGatewayAccessToken> {
        const cachedToken = this.cachedTokens.get(teamClusterId);

        if (cachedToken && Date.parse(cachedToken.expiresAt) - Date.now() > TOKEN_EXPIRY_SAFETY_WINDOW_MS) {
            return cachedToken;
        }

        const pendingToken = this.pendingTokens.get(teamClusterId);
        if (pendingToken) {
            return pendingToken;
        }

        const nextTokenPromise = this.issue(teamClusterId).finally(() => {
            this.pendingTokens.delete(teamClusterId);
        });

        this.pendingTokens.set(teamClusterId, nextTokenPromise);
        const token = await nextTokenPromise;
        this.cachedTokens.set(teamClusterId, token);
        return token;
    }

    private async issue(teamClusterId: string): Promise<ObjectGatewayAccessToken> {
        const teamCluster = await findTeamClusterByIdWithSensitiveData(teamClusterId);
        if (!teamCluster) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Team cluster not found');
        }

        const daemonPassword = await this.daemonCredentialGuard.getDecryptedDaemonPassword(teamCluster);
        const issuedAt = Math.floor(Date.now() / 1000);
        const claims: TeamClusterDirectAccessTokenClaims = {
            requesterKind: 'server',
            requesterId: 'volt-server',
            ownerClusterId: teamCluster.id,
            teamId: teamCluster.props.team,
            exposureId: OBJECT_GATEWAY_EXPOSURE_ID,
            exposureName: OBJECT_GATEWAY_EXPOSURE_NAME,
            accessMode: TeamClusterServiceExposureAccessMode.Http,
            iat: issuedAt,
            exp: issuedAt + TOKEN_TTL_SECONDS
        };

        return {
            token: jwt.sign(claims, daemonPassword, { algorithm: 'HS256' }),
            expiresAt: new Date((issuedAt + TOKEN_TTL_SECONDS) * 1000).toISOString()
        };
    }
}

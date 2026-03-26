import {
    TEAM_CLUSTER_DIRECT_ACCESS_BASE_PATH,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER,
    type TeamClusterDirectAccessGrantRequest,
    type TeamClusterDirectAccessGrantResponse
} from '@/shared/contracts';
import type { DaemonConfig } from '@/core/config';

interface DirectAccessGrantErrorPayload {
    code?: unknown;
    message?: unknown;
}

class DirectAccessGrantError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'DirectAccessGrantError';
    }
}

const GRANT_EXPIRY_SAFETY_WINDOW_MS = 5_000;

export class TeamClusterDirectAccessGrantClient {
    private readonly cachedGrants = new Map<string, TeamClusterDirectAccessGrantResponse>();
    private readonly pendingGrants = new Map<string, Promise<TeamClusterDirectAccessGrantResponse>>();

    constructor(
        private readonly config: DaemonConfig
    ) {}

    async getGrant(request: TeamClusterDirectAccessGrantRequest): Promise<TeamClusterDirectAccessGrantResponse> {
        const cacheKey = `${request.ownerClusterId}:${request.exposureName}:${request.accessMode}`;
        const cachedGrant = this.cachedGrants.get(cacheKey);
        const expiresAtMs = cachedGrant
            ? Date.parse(cachedGrant.expiresAt)
            : Number.NaN;

        if (cachedGrant && Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > GRANT_EXPIRY_SAFETY_WINDOW_MS) {
            return cachedGrant;
        }

        const pendingGrant = this.pendingGrants.get(cacheKey);
        if (pendingGrant) {
            return pendingGrant;
        }

        const nextGrantPromise = this.fetchGrant(request).finally(() => {
            this.pendingGrants.delete(cacheKey);
        });
        this.pendingGrants.set(cacheKey, nextGrantPromise);

        const grant = await nextGrantPromise;
        this.cachedGrants.set(cacheKey, grant);
        return grant;
    }

    private async fetchGrant(request: TeamClusterDirectAccessGrantRequest): Promise<TeamClusterDirectAccessGrantResponse> {
        const response = await fetch(`${this.config.voltCloudUrl}${TEAM_CLUSTER_DIRECT_ACCESS_BASE_PATH}/grants`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                [TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER]: this.config.teamClusterId,
                [TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER]: this.config.daemonPassword
            },
            body: JSON.stringify(request)
        });

        if (response.ok) {
            return response.json() as Promise<TeamClusterDirectAccessGrantResponse>;
        }

        let payload: DirectAccessGrantErrorPayload | undefined;
        try {
            payload = await response.json() as DirectAccessGrantErrorPayload;
        } catch {
            payload = undefined;
        }

        throw new DirectAccessGrantError(
            response.status,
            typeof payload?.code === 'string'
                ? payload.code
                : 'TeamCluster::DirectAccessGrantFailed',
            typeof payload?.message === 'string'
                ? payload.message
                : `Direct access grant request failed with status ${response.status}`
        );
    }
}

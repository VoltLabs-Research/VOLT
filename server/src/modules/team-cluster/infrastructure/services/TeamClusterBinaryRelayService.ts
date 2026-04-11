import {
    TeamClusterServiceExposureAccessMode,
    type TeamClusterDaemonBinaryRelayDescriptor
} from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import {
    readRelayHostValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import { randomUUID } from 'node:crypto';
import { createWebSocketStream } from 'ws';
import type { WebSocket } from 'ws';
import { inject, injectable } from 'tsyringe';
import { BinaryRelayDuplex } from './BinaryRelayDuplex';
import { BinaryRelaySessionRegistry } from './BinaryRelaySessionRegistry';
import type { BinaryRelaySessionRecord } from './BinaryRelaySessionRegistry';
import { BinaryRelayTokenService } from './BinaryRelayTokenService';
import type { Duplex } from 'node:stream';

interface OpenBinaryRelaySessionInput {
    teamClusterId: string;
    sessionId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    onLocalClose: (error?: Error | null) => void;
}

interface AuthorizeBinaryRelayUpgradeInput {
    relaySessionId?: string;
    relayToken?: string;
    relayProtocolVersion?: string;
}

export interface AuthorizedBinaryRelayUpgrade {
    relaySessionId: string;
    session: BinaryRelaySessionRecord;
}

export const TEAM_CLUSTER_BINARY_RELAY_PATH = '/internal/team-cluster/data-plane/v1/relay';
export const TEAM_CLUSTER_BINARY_RELAY_SESSION_HEADER = 'x-team-cluster-relay-session-id';
export const TEAM_CLUSTER_BINARY_RELAY_TOKEN_HEADER = 'x-team-cluster-relay-token';
export const TEAM_CLUSTER_BINARY_RELAY_PROTOCOL_HEADER = 'x-team-cluster-relay-protocol-version';

const DEFAULT_SERVER_PORT = 8000;
const LOOPBACK_BINARY_RELAY_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const readConfiguredBinaryRelayEndpoint = (): string | null => {
    const endpoint = process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT?.trim()
        || process.env.SERVER_ENDPOINT?.trim()
        || process.env.VOLT_CLOUD_URL?.trim();

    return endpoint || null;
};

const resolveBinaryRelayProtocol = (): 'ws' | 'wss' => {
    const configuredProtocol = process.env.TEAM_CLUSTER_BINARY_RELAY_PROTOCOL?.trim();
    if (configuredProtocol === 'ws' || configuredProtocol === 'wss') {
        return configuredProtocol;
    }

    const configuredEndpoint = readConfiguredBinaryRelayEndpoint();
    if (configuredEndpoint) {
        try {
            const protocol = new URL(configuredEndpoint).protocol.replace(':', '');
            if (protocol === 'https' || protocol === 'wss') {
                return 'wss';
            }
        } catch {
        }
    }

    return process.env.SERVER_SCHEMA?.trim() === 'https'
        ? 'wss'
        : 'ws';
};

@injectable()
export default class TeamClusterBinaryRelayService {
    constructor(
        @inject(BinaryRelaySessionRegistry)
        private readonly sessionRegistry: BinaryRelaySessionRegistry,

        @inject(BinaryRelayTokenService)
        private readonly tokenService: BinaryRelayTokenService
    ) {}

    openSession(input: OpenBinaryRelaySessionInput): { stream: BinaryRelayDuplex; relay: TeamClusterDaemonBinaryRelayDescriptor; } {
        const relaySessionId = randomUUID();
        const stream = new BinaryRelayDuplex({
            onActivity: () => {
                this.sessionRegistry.touchSession(relaySessionId);
            },
            onLocalClose: (error) => {
                this.sessionRegistry.forgetSession(relaySessionId);
                input.onLocalClose(error);
            },
            onRemoteClose: () => {
                this.sessionRegistry.forgetSession(relaySessionId);
            }
        });
        this.sessionRegistry.createSession({
            relaySessionId,
            teamClusterId: input.teamClusterId,
            sessionId: input.sessionId,
            accessMode: input.accessMode,
            stream
        });

        return {
            stream,
            relay: {
                relaySessionId,
                relayUrl: this.buildRelayUrl(),
                relayToken: this.tokenService.create({
                    relaySessionId,
                    teamClusterId: input.teamClusterId,
                    sessionId: input.sessionId,
                    accessMode: input.accessMode
                }),
                relayProtocolVersion: 1
            }
        };
    }

    authorizeUpgrade(input: AuthorizeBinaryRelayUpgradeInput): AuthorizedBinaryRelayUpgrade {
        if (!input.relaySessionId || !input.relayToken) {
            throw ApplicationError.unauthorized(
                'TeamCluster::BinaryRelayUnauthorized',
                'Binary relay authentication headers are required'
            );
        }

        if (input.relayProtocolVersion && input.relayProtocolVersion !== '1') {
            throw ApplicationError.badRequest(
                'TeamCluster::BinaryRelayProtocolMismatch',
                `Unsupported binary relay protocol version: ${input.relayProtocolVersion}`
            );
        }

        const verifiedToken = this.tokenService.verify(input.relayToken);
        if (!verifiedToken || verifiedToken.relaySessionId !== input.relaySessionId) {
            throw ApplicationError.unauthorized(
                'TeamCluster::BinaryRelayUnauthorized',
                'Binary relay token is invalid or expired'
            );
        }

        const session = this.sessionRegistry.beginAttach(verifiedToken.relaySessionId);
        if (!session) {
            throw ApplicationError.notFound(
                'TeamCluster::BinaryRelaySessionNotFound',
                'Binary relay session is not pending'
            );
        }

        if (
            session.teamClusterId !== verifiedToken.teamClusterId
            || session.sessionId !== verifiedToken.sessionId
            || session.accessMode !== verifiedToken.accessMode
            || session.relayProtocolVersion !== verifiedToken.relayProtocolVersion
        ) {
            this.sessionRegistry.rollbackAttach(verifiedToken.relaySessionId);
            throw ApplicationError.unauthorized(
                'TeamCluster::BinaryRelayUnauthorized',
                'Binary relay session claims do not match the pending session'
            );
        }

        return {
            relaySessionId: verifiedToken.relaySessionId,
            session
        };
    }

    rollbackUpgrade(claim: AuthorizedBinaryRelayUpgrade): void {
        this.sessionRegistry.rollbackAttach(claim.relaySessionId);
    }

    attachWebSocket(claim: AuthorizedBinaryRelayUpgrade, webSocket: WebSocket): void {
        const session = this.sessionRegistry.markAttached(claim.relaySessionId);
        if (!session) {
            webSocket.close(1011, 'Binary relay session expired');
            return;
        }

        const relayStream = createWebSocketStream(webSocket) as Duplex;
        session.stream.attach(relayStream);
    }

    closeSession(relaySessionId: string, error?: Error): void {
        this.sessionRegistry.closeSession(relaySessionId, error);
    }

    closeRemoteSession(relaySessionId: string, error?: Error): void {
        this.sessionRegistry.closeRemoteSession(relaySessionId, error);
    }

    private buildRelayUrl(): string {
        const configuredEndpoint = readConfiguredBinaryRelayEndpoint();
        if (configuredEndpoint) {
            try {
                const endpoint = new URL(configuredEndpoint);
                const protocol = endpoint.protocol === 'https:' || endpoint.protocol === 'wss:'
                    ? 'wss'
                    : 'ws';
                return new URL(TEAM_CLUSTER_BINARY_RELAY_PATH, `${protocol}://${endpoint.host}`).toString();
            } catch {
            }
        }

        const bindHost = readRelayHostValue('SERVER_HOST', '0.0.0.0');
        const advertisedHost = resolveRelayAdvertisedHost(bindHost, 'TEAM_CLUSTER_BINARY_RELAY_ADVERTISED_HOST');
        if (LOOPBACK_BINARY_RELAY_HOSTS.has(advertisedHost)) {
            throw ApplicationError.internalServerError(
                'Binary relay requires TEAM_CLUSTER_BINARY_RELAY_ENDPOINT, SERVER_ENDPOINT, or VOLT_CLOUD_URL to advertise a host reachable by cluster daemons.'
            );
        }

        const protocol = resolveBinaryRelayProtocol();
        const port = readNumberEnv('SERVER_PORT', DEFAULT_SERVER_PORT);
        return new URL(TEAM_CLUSTER_BINARY_RELAY_PATH, `${protocol}://${advertisedHost}:${port}`).toString();
    }
}

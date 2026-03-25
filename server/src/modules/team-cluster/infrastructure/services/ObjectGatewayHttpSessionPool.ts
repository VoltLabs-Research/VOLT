import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import logger from '@shared/infrastructure/logger';
import http from 'node:http';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { Duplex } from 'node:stream';
import { objectGatewayClientTelemetry } from './ObjectGatewayClientTelemetry';

export interface ObjectGatewayHttpSessionDescriptor {
    key: string;
    teamClusterId: string;
    exposureId: string;
    targetHost: string;
    targetPort: number;
    tunnel: Duplex;
    agent: http.Agent;
    ephemeral: boolean;
    inUse: boolean;
    expiresAt: number;
    destroyed: boolean;
}

interface AcquireObjectGatewayHttpSessionInput {
    teamClusterId: string;
    exposureId: string;
    targetHost: string;
    targetPort: number;
}

export class ObjectGatewayHttpSessionPool {
    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async acquire(input: AcquireObjectGatewayHttpSessionInput): Promise<ObjectGatewayHttpSessionDescriptor> {
        const tunnelOpenStartedAt = Date.now();
        const tunnel = await this.teamClusterDaemonClient.openTunnel(
            input.teamClusterId,
            input.exposureId,
            TeamClusterServiceExposureAccessMode.Http
        );
        const tunnelOpenDurationMs = Date.now() - tunnelOpenStartedAt;
        const session = this.createSession(input, tunnel);
        objectGatewayClientTelemetry.recordTunnelOpened(
            input.teamClusterId,
            input.exposureId,
            tunnelOpenDurationMs,
            true
        );
        objectGatewayClientTelemetry.recordSessionOpened(true);
        logger.debug({
            action: 'object-gateway.http-session.single-use',
            exposureId: input.exposureId,
            teamClusterId: input.teamClusterId
        }, 'Created single-use object gateway HTTP session');
        return session;
    }

    release(session: ObjectGatewayHttpSessionDescriptor, _destroySession = false): void {
        this.destroySession(session);
    }

    private createSession(
        input: AcquireObjectGatewayHttpSessionInput,
        tunnel: Duplex
    ): ObjectGatewayHttpSessionDescriptor {
        const agent = new http.Agent({
            keepAlive: false,
            maxSockets: 1,
            maxFreeSockets: 0
        });

        agent.createConnection = (): Duplex => tunnel;

        const session: ObjectGatewayHttpSessionDescriptor = {
            key: `${input.teamClusterId}:${input.exposureId}:${input.targetHost}:${input.targetPort}`,
            teamClusterId: input.teamClusterId,
            exposureId: input.exposureId,
            targetHost: input.targetHost,
            targetPort: input.targetPort,
            tunnel,
            agent,
            ephemeral: true,
            inUse: true,
            expiresAt: Date.now(),
            destroyed: false
        };

        const destroy = (): void => {
            this.destroySession(session);
        };

        tunnel.once('close', destroy);
        tunnel.once('error', destroy);

        return session;
    }

    private destroySession(session: ObjectGatewayHttpSessionDescriptor): void {
        if (session.destroyed) {
            return;
        }

        const wasInUse = session.inUse;
        session.destroyed = true;

        session.inUse = false;
        session.agent.destroy();
        session.tunnel.destroy();
        objectGatewayClientTelemetry.recordSessionDestroyed({
            ephemeral: true,
            wasInUse
        });
    }
}

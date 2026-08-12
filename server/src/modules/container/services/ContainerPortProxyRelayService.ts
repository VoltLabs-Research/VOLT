import { ErrorCodes } from '@core/constants/error-codes';
import containerPortProxyAccessTokenService from '@modules/container/services/ContainerPortProxyAccessTokenService';
import {
    serveRelayHttpRequest,
    serveRelayWebSocketUpgrade
} from '@modules/container/services/container-port-proxy-tunnel';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import {
    readRelayHostValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
import { resolveServerBaseUrl } from '@shared/infrastructure/utilities/server-url';
import http from 'node:http';


export interface ContainerPortRelayTarget {
    teamId: string;
    containerId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
    publicPort: number;
}

interface ContainerPortProxyRelay extends ContainerPortRelayTarget {
    server: http.Server;
}

interface CreateContainerPortAccessUrlInput extends ContainerPortRelayTarget {
    userId: string;
}

interface ContainerPortAccessUrl {
    url: string;
    expiresAt: string;
}

const DEFAULT_RELAY_BIND_HOST = '0.0.0.0';

const resolveContainerPortProxyRelayProtocol = (): 'http' | 'https' => {
    const configuredProtocol = process.env.TEAM_CLUSTER_APP_PROXY_PROTOCOL?.trim();
    if (configuredProtocol === 'http' || configuredProtocol === 'https') {
        return configuredProtocol;
    }

    return resolveServerBaseUrl().startsWith('https://') ? 'https' : 'http';
};

export class ContainerPortProxyRelayService {
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_APP_PROXY_BIND_HOST', DEFAULT_RELAY_BIND_HOST);
    private readonly advertisedHost = resolveRelayAdvertisedHost(this.bindHost, 'TEAM_CLUSTER_APP_PROXY_ADVERTISED_HOST');
    private readonly publicProtocol = resolveContainerPortProxyRelayProtocol();
    private readonly relaysByPublicPort = new Map<number, ContainerPortProxyRelay>();

    async createAccessUrl(input: CreateContainerPortAccessUrlInput): Promise<ContainerPortAccessUrl> {
        await this.ensureRelay(input);

        const url = containerPortProxyAccessTokenService.buildAccessUrl({
            containerId: input.containerId,
            privatePort: input.privatePort,
            publicPort: input.publicPort,
            userId: input.userId,
            advertisedHost: this.advertisedHost,
            protocol: this.publicProtocol
        });

        return {
            url,
            expiresAt: new Date(Date.now() + containerPortProxyAccessTokenService.getTtlMs()).toISOString()
        };
    }

    async ensureContainerRelays(relays: ContainerPortRelayTarget[]): Promise<void> {
        await Promise.all(relays.map((relay) => this.ensureRelay(relay)));
    }

    async syncContainerRelays(containerId: string, relays: ContainerPortRelayTarget[]): Promise<void> {
        const nextPublicPorts = new Set(relays.map((relay) => relay.publicPort));

        await this.stopPublicPortRelays(this.listPublicPorts((relay) => {
            return relay.containerId === containerId && !nextPublicPorts.has(relay.publicPort);
        }));
        await this.ensureContainerRelays(relays);
    }

    async stopContainerRelays(containerId: string): Promise<void> {
        await this.stopPublicPortRelays(this.listPublicPorts((relay) => relay.containerId === containerId));
    }

    async stopPublicPortRelays(publicPorts: number[]): Promise<void> {
        await Promise.all(publicPorts.map((publicPort) => this.stopRelay(publicPort)));
    }

    async stopAll(): Promise<void> {
        await this.stopPublicPortRelays(Array.from(this.relaysByPublicPort.keys()));
    }

    private listPublicPorts(matches: (relay: ContainerPortProxyRelay) => boolean): number[] {
        return Array.from(this.relaysByPublicPort.values())
            .filter(matches)
            .map((relay) => relay.publicPort);
    }

    private async ensureRelay(input: ContainerPortRelayTarget): Promise<void> {
        const existingRelay = this.relaysByPublicPort.get(input.publicPort);

        if (existingRelay) {
            if (existingRelay.containerId !== input.containerId || existingRelay.privatePort !== input.privatePort) {
                throw ApplicationError.conflict(
                    ErrorCodes.CONTAINER_PUBLIC_PORT_UNAVAILABLE,
                    `Public port ${input.publicPort} is already assigned to another container port`
                );
            }

            Object.assign(existingRelay, input);
            return;
        }

        const server = http.createServer((req, res) => {
            void serveRelayHttpRequest(this.relaysByPublicPort.get(input.publicPort), req, res);
        });

        server.on('upgrade', (request, socket, head) => {
            void serveRelayWebSocketUpgrade(this.relaysByPublicPort.get(input.publicPort), request, socket, head);
        });

        await this.listen(server, input.publicPort);

        this.relaysByPublicPort.set(input.publicPort, {
            ...input,
            server
        });

        logger.info(`Started container public port relay publicPort=${input.publicPort} teamId=${input.teamId} containerId=${input.containerId}`);
    }

    private async listen(server: http.Server, publicPort: number): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const cleanup = (): void => {
                server.off('error', onError);
                server.off('listening', onListening);
            };

            const onListening = (): void => {
                cleanup();
                resolve();
            };

            const onError = (error: Error): void => {
                cleanup();
                if (server.listening) {
                    server.close();
                }
                reject(error);
            };

            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(publicPort, this.bindHost);
        });
    }

    private async stopRelay(publicPort: number): Promise<void> {
        const relay = this.relaysByPublicPort.get(publicPort);
        if (!relay) {
            return;
        }

        this.relaysByPublicPort.delete(publicPort);

        await new Promise<void>((resolve) => {
            relay.server.close(() => resolve());
        });

        logger.info(`Stopped container public port relay publicPort=${publicPort} teamId=${relay.teamId} containerId=${relay.containerId}`);
    }
}

export default new ContainerPortProxyRelayService();

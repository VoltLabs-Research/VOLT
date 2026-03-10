import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import net from 'node:net';
import type TeamClusterExposureRegistryService from './TeamClusterExposureRegistryService';

interface PublicExposureBinding {
    exposureId: string;
    teamClusterId: string;
    publicPort: number;
    server: net.Server;
};

const DEFAULT_PUBLIC_PORT_START = 23000;
const DEFAULT_PUBLIC_PORT_END = 23999;

const readPortRangeValue = (name: string, fallback: number): number => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return fallback;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return value;
};

@injectable()
export default class TeamClusterTcpExposureRelayService {
    private readonly host = process.env.SERVER_HOST || '0.0.0.0';
    private readonly portStart = readPortRangeValue('TEAM_CLUSTER_TCP_RELAY_PORT_START', DEFAULT_PUBLIC_PORT_START);
    private readonly portEnd = readPortRangeValue('TEAM_CLUSTER_TCP_RELAY_PORT_END', DEFAULT_PUBLIC_PORT_END);
    private readonly bindingsByExposureId = new Map<string, PublicExposureBinding>();
    private readonly usedPorts = new Set<number>();
    private started = false;

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterExposureRegistryService)
        private readonly exposureRegistryService: TeamClusterExposureRegistryService
    ) {}

    start(): void {
        if (this.started) {
            return;
        }

        this.started = true;
        this.exposureRegistryService.onChanged(this.handleRegistryChanged);
        this.reconcileBindings().catch((error: unknown) => {
            logger.error({ err: error }, '[TcpExposureRelay] Failed to reconcile bindings on start');
        });
    }

    async stop(): Promise<void> {
        if (!this.started) {
            return;
        }

        this.started = false;
        this.exposureRegistryService.offChanged(this.handleRegistryChanged);
        await Promise.all(Array.from(this.bindingsByExposureId.values()).map((binding) => {
            return new Promise<void>((resolve) => {
                binding.server.close(() => resolve());
            });
        }));
        this.bindingsByExposureId.clear();
        this.usedPorts.clear();
    }

    getPublicPort(exposureId: string): number | null {
        return this.bindingsByExposureId.get(exposureId)?.publicPort || null;
    }

    private readonly handleRegistryChanged = (): void => {
        this.reconcileBindings().catch((error: unknown) => {
            logger.error({ err: error }, '[TcpExposureRelay] Failed to reconcile bindings');
        });
    };

    private async reconcileBindings(): Promise<void> {
        const activeExposures = this.exposureRegistryService.listActiveTcpExposures();
        const nextExposureIds = new Set(activeExposures.map((exposure) => exposure.id));

        for (const [exposureId, binding] of this.bindingsByExposureId.entries()) {
            if (nextExposureIds.has(exposureId)) {
                continue;
            }

            await new Promise<void>((resolve) => {
                binding.server.close(() => resolve());
            });
            logger.info(
                { exposureId, publicPort: binding.publicPort },
                '[TcpExposureRelay] Released public relay port'
            );
            this.usedPorts.delete(binding.publicPort);
            this.bindingsByExposureId.delete(exposureId);
        }

        for (const exposure of activeExposures) {
            if (this.bindingsByExposureId.has(exposure.id)) {
                continue;
            }

            const publicPort = this.reservePort();
            const server = net.createServer((socket) => {
                this.handleIncomingConnection(exposure.teamClusterId, exposure.id, socket).catch((error: unknown) => {
                    logger.error({ err: error, exposureId: exposure.id }, '[TcpExposureRelay] Failed to open tunnel for incoming socket');
                    socket.destroy();
                });
            });

            await new Promise<void>((resolve, reject) => {
                server.once('error', reject);
                server.listen(publicPort, this.host, () => {
                    server.removeListener('error', reject);
                    resolve();
                });
            });

            this.bindingsByExposureId.set(exposure.id, {
                exposureId: exposure.id,
                teamClusterId: exposure.teamClusterId,
                publicPort,
                server
            });
            logger.info(
                { exposureId: exposure.id, publicPort, teamClusterId: exposure.teamClusterId },
                '[TcpExposureRelay] Bound public relay port'
            );
        }
    }

    private async handleIncomingConnection(teamClusterId: string, exposureId: string, socket: net.Socket): Promise<void> {
        const tunnel = await this.teamClusterDaemonClient.openTunnel(
            teamClusterId,
            exposureId,
            TeamClusterServiceExposureAccessMode.Tcp
        );

        socket.pipe(tunnel).pipe(socket);

        const closeTunnel = () => {
            tunnel.destroy();
        };
        const closeSocket = () => {
            socket.destroy();
        };

        socket.on('close', closeTunnel);
        socket.on('error', closeTunnel);
        tunnel.on('close', closeSocket);
        tunnel.on('end', closeSocket);
        tunnel.on('error', closeSocket);
    }

    private reservePort(): number {
        for (let port = this.portStart; port <= this.portEnd; port += 1) {
            if (!this.usedPorts.has(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }

        throw new Error('No available public TCP relay ports');
    }
};

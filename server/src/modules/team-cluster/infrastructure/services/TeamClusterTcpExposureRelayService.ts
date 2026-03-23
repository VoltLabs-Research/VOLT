import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { LocalRelayPortAllocator } from '@shared/infrastructure/services/LocalRelayPortAllocator';
import logger from '@shared/infrastructure/logger';
import {
    readRelayHostValue,
    readRelayPortRangeValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
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
const DEFAULT_RELAY_BIND_HOST = '127.0.0.1';
const VNC_PRIVATE_PORT = 5901;

@injectable()
export default class TeamClusterTcpExposureRelayService {
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_TCP_RELAY_BIND_HOST', DEFAULT_RELAY_BIND_HOST);
    private readonly advertisedHost = resolveRelayAdvertisedHost(this.bindHost, 'TEAM_CLUSTER_TCP_RELAY_ADVERTISED_HOST');
    private readonly portStart = readRelayPortRangeValue('TEAM_CLUSTER_TCP_RELAY_PORT_START', DEFAULT_PUBLIC_PORT_START);
    private readonly portEnd = readRelayPortRangeValue('TEAM_CLUSTER_TCP_RELAY_PORT_END', DEFAULT_PUBLIC_PORT_END);
    private readonly bindingsByExposureId = new Map<string, PublicExposureBinding>();
    private readonly pendingBindingsByExposureId = new Map<string, Promise<number | null>>();
    private readonly portAllocator = new LocalRelayPortAllocator({
        portStart: this.portStart,
        portEnd: this.portEnd,
        exhaustedMessage: 'No available public TCP relay ports'
    });
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
            return this.portAllocator.close(binding.server);
        }));
        this.bindingsByExposureId.clear();
        this.pendingBindingsByExposureId.clear();
        this.portAllocator.reset();
    }

    getPublicPort(exposureId: string): number | null {
        return this.bindingsByExposureId.get(exposureId)?.publicPort || null;
    }

    async ensurePublicPort(exposureId: string): Promise<number | null> {
        const existingBinding = this.bindingsByExposureId.get(exposureId);
        if (existingBinding) {
            return existingBinding.publicPort;
        }

        const pendingBinding = this.pendingBindingsByExposureId.get(exposureId);
        if (pendingBinding) {
            return pendingBinding;
        }

        const bindingPromise = this.createBindingForExposure(exposureId)
            .finally(() => {
                this.pendingBindingsByExposureId.delete(exposureId);
            });

        this.pendingBindingsByExposureId.set(exposureId, bindingPromise);
        return bindingPromise;
    }

    /**
     * Returns the host that external TCP clients should use when opening the allocated relay port.
     */
    getRelayAdvertisedHost(): string {
        return this.advertisedHost;
    }

    private readonly handleRegistryChanged = (): void => {
        this.reconcileBindings().catch((error: unknown) => {
            logger.error({ err: error }, '[TcpExposureRelay] Failed to reconcile bindings');
        });
    };

    private async reconcileBindings(): Promise<void> {
        for (const [exposureId, binding] of this.bindingsByExposureId.entries()) {
            const exposure = this.exposureRegistryService.getExposure(exposureId);
            if (exposure && this.isRelayableExposure(exposure)) {
                continue;
            }

            await this.releaseBinding(binding);
        }
    }

    private async createBindingForExposure(exposureId: string): Promise<number | null> {
        const exposure = this.getRelayableExposure(exposureId);
        if (!exposure) {
            return null;
        }

        const existingBinding = this.bindingsByExposureId.get(exposureId);
        if (existingBinding) {
            return existingBinding.publicPort;
        }

        const publicPort = this.portAllocator.reservePort();
        const server = net.createServer((socket) => {
            this.handleIncomingConnection(exposure.teamClusterId, exposure.id, socket).catch((error: unknown) => {
                logger.error({ err: error, exposureId: exposure.id }, '[TcpExposureRelay] Failed to open tunnel for incoming socket');
                socket.destroy();
            });
        });

        await this.portAllocator.listen(server, publicPort, this.bindHost);

        const currentExposure = this.getRelayableExposure(exposureId);
        if (!currentExposure) {
            await this.portAllocator.close(server);
            this.portAllocator.releasePort(publicPort);
            return null;
        }

        this.bindingsByExposureId.set(currentExposure.id, {
            exposureId: currentExposure.id,
            teamClusterId: currentExposure.teamClusterId,
            publicPort,
            server
        });
        logger.info({
            exposureId: currentExposure.id,
            publicPort,
            teamClusterId: currentExposure.teamClusterId,
            bindHost: this.bindHost,
            advertisedHost: this.advertisedHost
        }, '[TcpExposureRelay] Bound local VNC relay port');

        return publicPort;
    }

    private async releaseBinding(binding: PublicExposureBinding): Promise<void> {
        await this.portAllocator.close(binding.server);
        logger.info(
            { exposureId: binding.exposureId, publicPort: binding.publicPort },
            '[TcpExposureRelay] Released local relay port'
        );
        this.portAllocator.releasePort(binding.publicPort);
        this.bindingsByExposureId.delete(binding.exposureId);
    }

    private getRelayableExposure(exposureId: string): TeamClusterServiceExposure | null {
        const exposure = this.exposureRegistryService.getExposure(exposureId);
        if (!exposure || !this.isRelayableExposure(exposure)) {
            return null;
        }

        return exposure;
    }

    private isRelayableExposure(exposure: TeamClusterServiceExposure): boolean {
        return exposure.sourceKind === TeamClusterServiceExposureSourceKind.Container
            && exposure.status === TeamClusterServiceExposureStatus.Active
            && exposure.accessModes.includes(TeamClusterServiceExposureAccessMode.Tcp)
            && exposure.containerPort === VNC_PRIVATE_PORT;
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

};

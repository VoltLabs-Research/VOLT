import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
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

const readHostValue = (name: string, fallback: string): string => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return fallback;
    }

    return rawValue;
};

const readOptionalHostValue = (name: string): string | null => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return null;
    }

    return rawValue;
};

const isWildcardHost = (value: string): boolean => {
    return value === '0.0.0.0' || value === '::' || value === '[::]';
};

const detectNonInternalIpv4Host = (): string | null => {
    const interfaces = networkInterfaces();

    for (const addresses of Object.values(interfaces)) {
        if (!addresses) {
            continue;
        }

        for (const address of addresses) {
            if (address.family !== 'IPv4' || address.internal || isWildcardHost(address.address)) {
                continue;
            }

            return address.address;
        }
    }

    return null;
};

const resolveRelayAdvertisedHost = (bindHost: string): string => {
    const configuredAdvertisedHost = readOptionalHostValue('TEAM_CLUSTER_TCP_RELAY_ADVERTISED_HOST');
    if (configuredAdvertisedHost) {
        if (isWildcardHost(configuredAdvertisedHost)) {
            throw new Error('TEAM_CLUSTER_TCP_RELAY_ADVERTISED_HOST must be a reachable host, not a wildcard bind address');
        }

        return configuredAdvertisedHost;
    }

    if (!isWildcardHost(bindHost)) {
        return bindHost;
    }

    const configuredServerHostname = readOptionalHostValue('SERVER_HOSTNAME');
    if (configuredServerHostname) {
        if (!isWildcardHost(configuredServerHostname)) {
            return configuredServerHostname;
        }

        logger.warn(
            { bindHost, serverHostname: configuredServerHostname },
            '[TcpExposureRelay] Ignoring wildcard SERVER_HOSTNAME for relay advertised host resolution'
        );
    }

    const autoDetectedHost = detectNonInternalIpv4Host();
    if (autoDetectedHost) {
        logger.warn(
            { bindHost, advertisedHost: autoDetectedHost },
            '[TcpExposureRelay] Auto-detected relay advertised host because bind host is wildcard'
        );
        return autoDetectedHost;
    }

    logger.error(
        { bindHost },
        '[TcpExposureRelay] Unable to determine a reachable relay advertised host for wildcard bind host'
    );
    throw new Error(
        'Unable to determine a reachable TEAM_CLUSTER_TCP_RELAY_ADVERTISED_HOST. Configure TEAM_CLUSTER_TCP_RELAY_ADVERTISED_HOST or SERVER_HOSTNAME to a non-wildcard host.'
    );
};

@injectable()
export default class TeamClusterTcpExposureRelayService {
    private readonly bindHost = readHostValue('TEAM_CLUSTER_TCP_RELAY_BIND_HOST', DEFAULT_RELAY_BIND_HOST);
    private readonly advertisedHost = resolveRelayAdvertisedHost(this.bindHost);
    private readonly portStart = readPortRangeValue('TEAM_CLUSTER_TCP_RELAY_PORT_START', DEFAULT_PUBLIC_PORT_START);
    private readonly portEnd = readPortRangeValue('TEAM_CLUSTER_TCP_RELAY_PORT_END', DEFAULT_PUBLIC_PORT_END);
    private readonly bindingsByExposureId = new Map<string, PublicExposureBinding>();
    private readonly pendingBindingsByExposureId = new Map<string, Promise<number | null>>();
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
            return this.closeServer(binding.server);
        }));
        this.bindingsByExposureId.clear();
        this.pendingBindingsByExposureId.clear();
        this.usedPorts.clear();
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

        const publicPort = this.reservePort();
        const server = net.createServer((socket) => {
            this.handleIncomingConnection(exposure.teamClusterId, exposure.id, socket).catch((error: unknown) => {
                logger.error({ err: error, exposureId: exposure.id }, '[TcpExposureRelay] Failed to open tunnel for incoming socket');
                socket.destroy();
            });
        });

        try {
            await new Promise<void>((resolve, reject) => {
                server.once('error', reject);
                server.listen(publicPort, this.bindHost, () => {
                    server.removeListener('error', reject);
                    resolve();
                });
            });
        } catch (error) {
            this.usedPorts.delete(publicPort);
            throw error;
        }

        const currentExposure = this.getRelayableExposure(exposureId);
        if (!currentExposure) {
            await this.closeServer(server);
            this.usedPorts.delete(publicPort);
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
        await this.closeServer(binding.server);
        logger.info(
            { exposureId: binding.exposureId, publicPort: binding.publicPort },
            '[TcpExposureRelay] Released local relay port'
        );
        this.usedPorts.delete(binding.publicPort);
        this.bindingsByExposureId.delete(binding.exposureId);
    }

    private getRelayableExposure(exposureId: string): TeamClusterServiceExposure | null {
        const exposure = this.exposureRegistryService.getExposure(exposureId);
        if (!exposure || !this.isRelayableExposure(exposure)) {
            return null;
        }

        return exposure;
    }

    private closeServer(server: net.Server): Promise<void> {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }

    private isRelayableExposure(exposure: TeamClusterServiceExposure): boolean {
        return exposure.status === TeamClusterServiceExposureStatus.Active
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

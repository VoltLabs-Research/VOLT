import { ErrorCodes } from '@core/constants/error-codes';
import type { ContainerPortMapping } from '@modules/container/domain/port/IContainerService';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { readRelayHostValue, readRelayPortRangeValue } from '@shared/infrastructure/utilities/relay-network';
import net from 'node:net';

const DEFAULT_PUBLIC_PORT_START = 24000;
const DEFAULT_PUBLIC_PORT_END = 24999;
const DEFAULT_BIND_HOST = '0.0.0.0';

interface ReservePortMappingsOptions {
    excludeContainerId?: string;
}

interface ReservedPortMappings {
    ports: ContainerPortMapping[];
    reservedPublicPorts: number[];
}

@Singleton()
export class ContainerPublicPortAllocator {
    private readonly portStart = readRelayPortRangeValue('TEAM_CLUSTER_APP_PROXY_PORT_START', DEFAULT_PUBLIC_PORT_START);
    private readonly portEnd = readRelayPortRangeValue('TEAM_CLUSTER_APP_PROXY_PORT_END', DEFAULT_PUBLIC_PORT_END);
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_APP_PROXY_BIND_HOST', DEFAULT_BIND_HOST);
    private readonly reservedPorts = new Set<number>();

    constructor(private readonly containerRepository: ContainerRepository) {
        if (this.portEnd < this.portStart) {
            throw new Error('TEAM_CLUSTER_APP_PROXY_PORT_END must be greater than or equal to TEAM_CLUSTER_APP_PROXY_PORT_START');
        }
    }

    async reservePortMappings(
        ports: ContainerPortMapping[] | undefined,
        options: ReservePortMappingsOptions = {}
    ): Promise<ReservedPortMappings> {
        if (!ports?.length) {
            return {
                ports: [],
                reservedPublicPorts: []
            };
        }

        this.assertUniquePrivatePorts(ports);

        const reservedPublicPorts: number[] = [];

        try {
            const resolvedPorts: ContainerPortMapping[] = [];

            for (const port of ports) {
                const publicPort = await this.reservePublicPort(port.public, options);
                reservedPublicPorts.push(publicPort);
                resolvedPorts.push({
                    private: port.private,
                    public: publicPort
                });
            }

            return {
                ports: resolvedPorts,
                reservedPublicPorts
            };
        } catch (error) {
            this.releaseReservations(reservedPublicPorts);
            throw error;
        }
    }

    commitReservations(publicPorts: number[]): void {
        publicPorts.forEach((port) => {
            this.reservedPorts.delete(port);
        });
    }

    releaseReservations(publicPorts: number[]): void {
        publicPorts.forEach((port) => {
            this.reservedPorts.delete(port);
        });
    }

    isInPublicRange(port: number): boolean {
        return Number.isInteger(port) && port >= this.portStart && port <= this.portEnd;
    }

    private async reservePublicPort(
        requestedPublicPort: number | undefined,
        options: ReservePortMappingsOptions
    ): Promise<number> {
        if (typeof requestedPublicPort === 'number') {
            await this.assertPublicPortAvailable(requestedPublicPort, options);
            this.reservedPorts.add(requestedPublicPort);
            return requestedPublicPort;
        }

        for (let publicPort = this.portStart; publicPort <= this.portEnd; publicPort += 1) {
            if (await this.canReservePublicPort(publicPort, options)) {
                this.reservedPorts.add(publicPort);
                return publicPort;
            }
        }

        throw ApplicationError.conflict(
            'Container::PublicPortUnavailable',
            `No available container public ports in range ${this.portStart}-${this.portEnd}`
        );
    }

    private async assertPublicPortAvailable(
        publicPort: number,
        options: ReservePortMappingsOptions
    ): Promise<void> {
        if (!this.isInPublicRange(publicPort)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Public port ${publicPort} is outside the allowed range ${this.portStart}-${this.portEnd}`
            );
        }

        if (!await this.canReservePublicPort(publicPort, options)) {
            throw ApplicationError.conflict(
                'Container::PublicPortUnavailable',
                `Public port ${publicPort} is already in use`
            );
        }
    }

    private async canReservePublicPort(
        publicPort: number,
        options: ReservePortMappingsOptions
    ): Promise<boolean> {
        if (this.reservedPorts.has(publicPort)) {
            return false;
        }

        const assigned = await this.containerRepository.isPublicPortAssigned(publicPort, options.excludeContainerId);
        if (assigned) {
            return false;
        }

        return this.isLocalPortAvailable(publicPort);
    }

    private async isLocalPortAvailable(publicPort: number): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const server = net.createServer();
            server.unref();
            server.once('error', () => resolve(false));
            server.listen(publicPort, this.bindHost, () => {
                server.close(() => resolve(true));
            });
        });
    }

    private assertUniquePrivatePorts(ports: ContainerPortMapping[]): void {
        const privatePorts = new Set<number>();

        for (const port of ports) {
            if (privatePorts.has(port.private)) {
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    `Container port ${port.private} is declared more than once`
                );
            }

            privatePorts.add(port.private);
        }
    }
}

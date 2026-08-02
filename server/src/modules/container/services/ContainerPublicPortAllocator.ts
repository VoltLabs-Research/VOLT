import { ErrorCodes } from '@core/constants/error-codes';
import type { ContainerPortMapping } from '@shared/contracts/ports/IContainerService';
import Container from '@modules/container/models/Container';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { readRelayHostValue } from '@shared/infrastructure/utilities/relay-network';
import { Not } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import net from 'node:net';

const DEFAULT_PUBLIC_PORT_START = 24000;
const DEFAULT_PUBLIC_PORT_END = 24999;
const DEFAULT_BIND_HOST = '0.0.0.0';

interface ReservedPortMappings{
    ports: ContainerPortMapping[];
    reservedPublicPorts: number[];
}

export class ContainerPublicPortAllocator{
    private readonly portStart = readPositiveIntegerEnv('TEAM_CLUSTER_APP_PROXY_PORT_START', DEFAULT_PUBLIC_PORT_START);
    private readonly portEnd = readPositiveIntegerEnv('TEAM_CLUSTER_APP_PROXY_PORT_END', DEFAULT_PUBLIC_PORT_END);
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_APP_PROXY_BIND_HOST', DEFAULT_BIND_HOST);
    private readonly reservedPorts = new Set<number>();

    constructor(){
        if(this.portEnd < this.portStart){
            throw new Error('TEAM_CLUSTER_APP_PROXY_PORT_END must be greater than or equal to TEAM_CLUSTER_APP_PROXY_PORT_START');
        }
    }

    /**
     * Resolves every requested private port to a public one. `existingPorts` is
     * the container's current mapping on an update: a private port that already
     * owns a public port keeps it unless the caller asks for a different one, so
     * editing environment variables does not silently renumber live relays.
     * `containerId` excludes the container being updated from the in-use scan.
     */
    async reservePortMappings(
        requestedPorts: ContainerPortMapping[] | undefined,
        existingPorts: ContainerPortMapping[] = [],
        containerId?: string
    ): Promise<ReservedPortMappings>{
        const ports = requestedPorts ?? [];
        this.assertUniquePrivatePorts(ports);

        const existingPortsByPrivatePort = new Map(existingPorts.map((port) => [port.private, port]));
        const resolvedPublicPorts = new Set<number>();
        const resolvedPorts: ContainerPortMapping[] = [];
        const reservedPublicPorts: number[] = [];

        try{
            for(const requestedPort of ports){
                const existingPort = existingPortsByPrivatePort.get(requestedPort.private);
                let publicPort = existingPort?.public
                    && (requestedPort.public === undefined || requestedPort.public === existingPort.public)
                    ? existingPort.public
                    : undefined;

                if(publicPort === undefined){
                    publicPort = await this.reservePublicPort(requestedPort.public, containerId);
                    reservedPublicPorts.push(publicPort);
                }

                this.assertUniqueResolvedPublicPort(publicPort, resolvedPublicPorts);
                resolvedPorts.push({
                    private: requestedPort.private,
                    public: publicPort
                });
            }

            return {
                ports: resolvedPorts,
                reservedPublicPorts
            };
        }catch(error){
            this.releaseReservations(reservedPublicPorts);
            throw error;
        }
    }

    /**
     * Drops the in-memory hold, whatever the outcome: on success the persisted
     * container row is what keeps the port taken, on failure it returns to the
     * pool. The hold only exists to stop two concurrent allocations picking the
     * same port before either is written.
     */
    releaseReservations(publicPorts: number[]): void{
        publicPorts.forEach((port) => {
            this.reservedPorts.delete(port);
        });
    }

    private async isPublicPortAssigned(publicPort: number, excludeContainerId?: string): Promise<boolean>{
        const where: FindOptionsWhere<Container> = excludeContainerId
            ? { id: Not(excludeContainerId) }
            : {};

        const containers = await Container.find({
            where,
            select: { ports: true }
        });

        return containers.some((container) => container.ports.some((port) => port.public === publicPort));
    }

    private async reservePublicPort(
        requestedPublicPort: number | undefined,
        excludeContainerId?: string
    ): Promise<number>{
        if(requestedPublicPort !== undefined){
            if(requestedPublicPort < this.portStart || requestedPublicPort > this.portEnd){
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    `Public port ${requestedPublicPort} is outside the allowed range ${this.portStart}-${this.portEnd}`
                );
            }

            if(!await this.canReservePublicPort(requestedPublicPort, excludeContainerId)){
                throw ApplicationError.conflict(
                    ErrorCodes.CONTAINER_PUBLIC_PORT_UNAVAILABLE,
                    `Public port ${requestedPublicPort} is already in use`
                );
            }

            this.reservedPorts.add(requestedPublicPort);
            return requestedPublicPort;
        }

        for(let publicPort = this.portStart; publicPort <= this.portEnd; publicPort += 1){
            if(await this.canReservePublicPort(publicPort, excludeContainerId)){
                this.reservedPorts.add(publicPort);
                return publicPort;
            }
        }

        throw ApplicationError.conflict(
            ErrorCodes.CONTAINER_PUBLIC_PORT_UNAVAILABLE,
            `No available container public ports in range ${this.portStart}-${this.portEnd}`
        );
    }

    private async canReservePublicPort(publicPort: number, excludeContainerId?: string): Promise<boolean>{
        if(this.reservedPorts.has(publicPort)){
            return false;
        }

        if(await this.isPublicPortAssigned(publicPort, excludeContainerId)){
            return false;
        }

        return this.isLocalPortAvailable(publicPort);
    }

    private async isLocalPortAvailable(publicPort: number): Promise<boolean>{
        return new Promise<boolean>((resolve) => {
            const server = net.createServer();
            server.unref();
            server.once('error', () => resolve(false));
            server.listen(publicPort, this.bindHost, () => {
                server.close(() => resolve(true));
            });
        });
    }

    private assertUniquePrivatePorts(ports: ContainerPortMapping[]): void{
        const privatePorts = new Set<number>();

        for(const port of ports){
            if(privatePorts.has(port.private)){
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    `Container port ${port.private} is declared more than once`
                );
            }

            privatePorts.add(port.private);
        }
    }

    private assertUniqueResolvedPublicPort(publicPort: number, resolvedPublicPorts: Set<number>): void{
        if(resolvedPublicPorts.has(publicPort)){
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Public port ${publicPort} is declared more than once`
            );
        }

        resolvedPublicPorts.add(publicPort);
    }
}

export default new ContainerPublicPortAllocator();

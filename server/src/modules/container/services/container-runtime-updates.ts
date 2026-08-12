import { ErrorCodes } from '@core/constants/error-codes';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import Container from '@modules/container/models/Container';
import daemonContainerRuntimeService from '@modules/container/services/DaemonContainerRuntimeService';
import containerPublicPortAllocator from '@modules/container/services/ContainerPublicPortAllocator';
import containerPortProxyRelayService from '@modules/container/services/ContainerPortProxyRelayService';
import type { ContainerPortRelayTarget } from '@modules/container/services/ContainerPortProxyRelayService';
import { requireContainerRuntimeTarget } from '@modules/container/services/container-lookup';
import { resolveInternalIp, toRelayTargets } from '@modules/container/services/container-network';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ContainerPortMapping } from '@shared/contracts/ports/ContainerRuntime';
import type { UpdateContainerInput } from '@volt/contracts/modules/container/http';


const applyRuntimeAction = async (
    container: Container,
    teamId: string,
    teamClusterId: string,
    action: NonNullable<UpdateContainerInput['action']>
): Promise<{ container: Container; status: string }> => {
    const runtimeContainer = await daemonContainerRuntimeService.applyContainerAction(teamClusterId, container.containerId, action);
    container.status = runtimeContainer.State?.Status || (action === 'stop' ? 'exited' : 'running');

    const internalIp = resolveInternalIp(runtimeContainer);
    if(internalIp){
        container.internalIp = internalIp;
    }

    await container.save();

    if(internalIp && (action === 'start' || action === 'restart')){
        await containerPortProxyRelayService.ensureContainerRelays(toRelayTargets({
            teamId,
            containerId: container.id,
            teamClusterId,
            internalIp
        }, container.ports));
    }

    await eventBus.emit('container.updated', {
        containerId: container.id,
        teamId,
        containerName: container.name
    });

    return {
        container,
        status: container.status
    };
};

export const updateContainer = async (
    teamId: string,
    containerId: string,
    input: UpdateContainerInput
): Promise<{ container: Container | null; status?: string }> => {
    const { action, env, ports } = input;
    const { container, teamClusterId } = await requireContainerRuntimeTarget(containerId, teamId);

    if(action){
        return applyRuntimeAction(container, teamId, teamClusterId, action);
    }

    let reservedPublicPorts: number[] = [];
    let nextRelays: ContainerPortRelayTarget[] = [];
    let newPublicPorts: number[] = [];
    let nextPorts: ContainerPortMapping[] | undefined;

    if(ports){
        const resolvedPorts = await containerPublicPortAllocator.reservePortMappings(ports, container.ports, container.id);
        nextPorts = resolvedPorts.ports;
        reservedPublicPorts = resolvedPorts.reservedPublicPorts;
        const existingPublicPorts = new Set(container.ports
            .map((port) => port.public)
            .filter((port): port is number => (port ?? 0) > 0));
        if(!container.internalIp){
            throw ApplicationError.conflict(ErrorCodes.CONTAINER_PORT_UNAVAILABLE, 'Container networking is not ready yet');
        }

        nextRelays = toRelayTargets({
            teamId,
            containerId: container.id,
            teamClusterId,
            internalIp: container.internalIp
        }, nextPorts);
        newPublicPorts = nextRelays
            .map((relay) => relay.publicPort)
            .filter((publicPort) => !existingPublicPorts.has(publicPort));
    }

    try{
        if(nextRelays.length > 0){
            await containerPortProxyRelayService.ensureContainerRelays(nextRelays);
        }

        container.env = env || container.env;
        if(nextPorts){
            container.ports = nextPorts;
        }
        await container.save();
        containerPublicPortAllocator.releaseReservations(reservedPublicPorts);

        if(nextPorts){
            await containerPortProxyRelayService.syncContainerRelays(container.id, nextRelays);
        }

        await eventBus.emit('container.updated', {
            containerId,
            teamId,
            containerName: container.name
        });

        return { container };
    }catch(error){
        containerPublicPortAllocator.releaseReservations(reservedPublicPorts);
        await containerPortProxyRelayService.stopPublicPortRelays(newPublicPorts).catch(() => undefined);
        throw error;
    }
};

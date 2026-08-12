import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import Container from '@modules/container/models/Container';
import daemonContainerRuntimeService from '@modules/container/services/DaemonContainerRuntimeService';
import containerPublicPortAllocator from '@modules/container/services/ContainerPublicPortAllocator';
import containerPortProxyRelayService from '@modules/container/services/ContainerPortProxyRelayService';
import { requireContainerRuntimeTarget } from '@modules/container/services/container-lookup';
import { resolveInternalIp, toRelayTargets } from '@modules/container/services/container-network';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRepository';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderService from '@shared/domain/catalog/CatalogFolderService';
import type { CreateContainerInput } from '@volt/contracts/modules/container/http';


const MB_PER_GB = 1024;
const DEFAULT_MEMORY_IN_MEGABYTES = 512;
const DEFAULT_CPU_COUNT = 1;

const folders = new CatalogFolderService(CatalogFolderKind.Container);

const assertFitsClusterCapacity = async (
    teamClusterId: string,
    memoryInMegabytes: number,
    cpuCount: number
): Promise<void> => {
    const metrics = await systemMetricsRepository.getLatestByClusterId(teamClusterId);
    if(!metrics){
        return;
    }

    const maxCpus = metrics.cpu.cores;
    const maxMemoryInMegabytes = Math.floor(metrics.memory.total * MB_PER_GB);

    if(cpuCount > maxCpus){
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Requested CPU allocation exceeds cluster capacity (${maxCpus} vCPU max)`);
    }
    if(memoryInMegabytes > maxMemoryInMegabytes){
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Requested memory allocation exceeds cluster capacity (${maxMemoryInMegabytes} MB max)`);
    }
};

export const createContainer = async (
    teamId: string,
    userId: string,
    input: CreateContainerInput
): Promise<{ container: Container }> => {
    const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd, memory, cpus } = input;

    if(input.folderId){
        await folders.require(teamId, input.folderId, 'Target container folder not found');
    }

    const teamClusterId = await teamClusterSelectionService.resolveConnectedClusterId(teamId, input.teamClusterId);

    let containerCmd = cmd?.length ? cmd : undefined;
    if(!containerCmd && !useImageCmd){
        containerCmd = ['tail', '-f', '/dev/null'];
    }

    const memoryInMegabytes = memory || DEFAULT_MEMORY_IN_MEGABYTES;
    const cpuCount = cpus || DEFAULT_CPU_COUNT;
    await assertFitsClusterCapacity(teamClusterId, memoryInMegabytes, cpuCount);

    const sanitizedName = name.replace(/\s+/g, '-').toLowerCase();
    const binds: string[] = [`Volt-${sanitizedName}-data:/data`];

    if(mountDockerSocket){
        binds.push('/var/run/docker.sock:/var/run/docker.sock');
    }

    const reservedPortMappings = await containerPublicPortAllocator.reservePortMappings(ports);
    const assignedPorts = reservedPortMappings.ports;
    let dockerId: string | null = null;
    let persistedContainerId: string | null = null;

    try{
        const containerInfo = await daemonContainerRuntimeService.createContainer(teamClusterId, {
            image,
            name: `${name.replace(/\s+/g, '-')}-${Date.now()}`,
            operationId: input.operationId,
            env,
            ports: assignedPorts.map((port) => ({ private: port.private })),
            labels: {
                'volt.team.id': teamId,
                'volt.team-cluster.id': teamClusterId
            },
            memoryInMegabytes,
            cpus: cpuCount,
            binds,
            cmd: containerCmd
        });
        dockerId = containerInfo.Id;
        const runtimeContainer = await daemonContainerRuntimeService.getContainer(teamClusterId, dockerId);
        const internalIp = resolveInternalIp(runtimeContainer);
        if(!internalIp){
            throw ApplicationError.conflict(ErrorCodes.CONTAINER_NETWORKING_UNAVAILABLE, 'Container networking is not ready');
        }

        const container = await Container.create({
            name,
            image,
            containerId: dockerId,
            folder: input.folderId || null,
            status: runtimeContainer.State?.Status || containerInfo.State?.Status || 'running',
            memory: memoryInMegabytes,
            cpus: cpuCount,
            env: env || [],
            ports: assignedPorts,
            createdBy: userId,
            team: teamId,
            teamCluster: teamClusterId,
            mountDockerSocket: mountDockerSocket || false,
            internalIp
        }).save();
        persistedContainerId = container.id;

        await containerPortProxyRelayService.ensureContainerRelays(toRelayTargets({
            teamId,
            containerId: persistedContainerId,
            teamClusterId,
            internalIp
        }, assignedPorts));
        containerPublicPortAllocator.releaseReservations(reservedPortMappings.reservedPublicPorts);

        await eventBus.emit('container.created', {
            containerId: persistedContainerId,
            teamId,
            name,
            userId
        });

        return { container };
    }catch(error){
        containerPublicPortAllocator.releaseReservations(reservedPortMappings.reservedPublicPorts);

        if(persistedContainerId){
            await Container.delete({ id: persistedContainerId }).catch(() => undefined);
            await containerPortProxyRelayService.stopContainerRelays(persistedContainerId).catch(() => undefined);
        }

        if(dockerId){
            await daemonContainerRuntimeService.removeContainer(teamClusterId, dockerId).catch(() => undefined);
        }

        throw error;
    }
};

export const deleteContainer = async (
    teamId: string,
    containerId: string,
    userId: string
): Promise<{ message: string }> => {
    const { container, teamClusterId } = await requireContainerRuntimeTarget(containerId, teamId);

    await daemonContainerRuntimeService.removeContainer(teamClusterId, container.containerId);
    await Container.delete({ id: containerId });
    await containerPortProxyRelayService.stopContainerRelays(container.id);

    await eventBus.emit('container.deleted', {
        containerId,
        teamId: container.team ?? '',
        userId,
        containerName: container.name ?? ''
    });

    return { message: 'Container deleted successfully' };
};

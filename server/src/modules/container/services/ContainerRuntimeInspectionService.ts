import { ErrorCodes } from '@core/constants/error-codes';
import daemonContainerRuntimeService from '@modules/container/services/DaemonContainerRuntimeService';
import { requireContainerRuntimeTarget } from '@modules/container/services/container-lookup';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    ContainerFileEntry,
    ContainerProcessInfo
} from '@shared/contracts/ports/IContainerService';

/* Read-only introspection of a running container: directory listings, file
   contents, process table and resource usage. Nothing here mutates state, so
   the only concern beyond forwarding to the daemon is turning daemon-side
   state conflicts into the right HTTP status. */

const BYTES_PER_MEGABYTE = 1024 * 1024;

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100;

export class ContainerRuntimeInspectionService{
    async getFiles(teamId: string, containerId: string, path?: string): Promise<{ files: ContainerFileEntry[] }>{
        const target = await requireContainerRuntimeTarget(containerId, teamId);
        const files = await this.#runtimeCall(() => daemonContainerRuntimeService.getFiles(
            target.teamClusterId,
            target.container.containerId,
            path || '/'
        ));

        return { files };
    }

    async readFile(teamId: string, containerId: string, path: string): Promise<{ content: string }>{
        const target = await requireContainerRuntimeTarget(containerId, teamId);

        try{
            const content = await this.#runtimeCall(() => daemonContainerRuntimeService.readFile(
                target.teamClusterId,
                target.container.containerId,
                path
            ));

            return { content };
        }catch(error){
            if(error instanceof Error && /is a directory/i.test(error.message)){
                throw ApplicationError.badRequest(ErrorCodes.CONTAINER_FILE_IS_DIRECTORY, 'The requested path is a directory, not a file');
            }

            throw error;
        }
    }

    async getProcesses(teamId: string, containerId: string): Promise<{ processes: ContainerProcessInfo[] }>{
        const target = await requireContainerRuntimeTarget(containerId, teamId);
        const processes = await this.#runtimeCall(() => daemonContainerRuntimeService.getProcesses(
            target.teamClusterId,
            target.container.containerId
        ));

        return { processes };
    }

    async getStats(teamId: string, containerId: string){
        const { container, teamClusterId } = await requireContainerRuntimeTarget(containerId, teamId);
        const stats = await daemonContainerRuntimeService.getStats(teamClusterId, container.containerId);

        const usedMB = (stats.memory_stats?.usage ?? 0) / BYTES_PER_MEGABYTE;
        const totalMB = (stats.memory_stats?.limit ?? 0) / BYTES_PER_MEGABYTE;

        let rxBytes = 0;
        let txBytes = 0;
        for(const iface of Object.values(stats.networks ?? {})){
            rxBytes += iface.rx_bytes ?? 0;
            txBytes += iface.tx_bytes ?? 0;
        }

        return {
            stats,
            limits: {
                memory: container.memory * BYTES_PER_MEGABYTE,
                cpus: container.cpus
            },
            memoryMB: {
                used: roundToTwoDecimals(usedMB),
                total: roundToTwoDecimals(totalMB),
                free: roundToTwoDecimals(totalMB - usedMB)
            },
            networkTotals: {
                rxBytes,
                txBytes
            }
        };
    }

    /**
     * Docker answers 409 when the container is not running. That is a state
     * conflict caused by the request, not a server failure, so it must not
     * surface as a 500 carrying the raw daemon message.
     */
    async #runtimeCall<T>(operation: () => Promise<T>): Promise<T>{
        try{
            return await operation();
        }catch(error){
            if(error instanceof Error && /is not running|container stopped\/paused/i.test(error.message)){
                throw ApplicationError.conflict(ErrorCodes.CONTAINER_NOT_RUNNING, 'The container is not running');
            }

            throw error;
        }
    }
}

export default new ContainerRuntimeInspectionService();

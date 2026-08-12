import Container from '@modules/container/models/Container';
import daemonContainerRuntimeService from '@modules/container/services/DaemonContainerRuntimeService';
import type { RuntimeContainerSummary } from '@modules/container/services/DaemonContainerRuntimeService';
import { PLACEHOLDER_INTERNAL_IP, resolveNonPlaceholderInternalIp } from '@modules/container/services/container-network';
import logger from '@shared/infrastructure/logger';


interface RuntimeStatusSnapshot{
    id: string;
    containerId: string;
    status: string;
    internalIp?: string;
    teamClusterId: string;
}

export class ContainerRuntimeStatusSynchronizer{
    schedule(containers: Container[]): void{
        const snapshot = containers
            .filter((container) => Boolean(container.teamCluster))
            .map((container) => ({
                id: container.id,
                containerId: container.containerId,
                status: container.status,
                internalIp: container.internalIp ?? undefined,
                teamClusterId: container.teamCluster
            }));

        void this.#sync(snapshot).catch(() => {
            logger.warn(`Background container runtime sync failed containerCount=${containers.length}`);
        });
    }

    async #sync(containers: RuntimeStatusSnapshot[]): Promise<void>{
        const runtimeIndex = new Map<string, RuntimeContainerSummary>();
        const teamClusterIds = Array.from(new Set(containers.map((container) => container.teamClusterId)));

        await Promise.all(teamClusterIds.map(async (teamClusterId) => {
            const runtimeContainers = await daemonContainerRuntimeService.listContainers(teamClusterId).catch(() => []);
            runtimeContainers.forEach((runtimeContainer) => {
                runtimeIndex.set(`${teamClusterId}:${runtimeContainer.Id}`, runtimeContainer);
            });
        }));

        await Promise.all(containers.map(async (container) => {
            const runtimeContainer = runtimeIndex.get(`${container.teamClusterId}:${container.containerId}`);
            if(!runtimeContainer){
                return;
            }

            const update: { status?: string; internalIp?: string } = {};
            if(runtimeContainer.State && runtimeContainer.State !== container.status){
                update.status = runtimeContainer.State;
            }

            if(container.internalIp === undefined || container.internalIp === PLACEHOLDER_INTERNAL_IP){
                const runtimeInternalIp = await this.#resolveInternalIp(container.teamClusterId, container.containerId);
                if(runtimeInternalIp !== undefined && container.internalIp !== runtimeInternalIp){
                    update.internalIp = runtimeInternalIp;
                }
            }

            if(Object.keys(update).length === 0){
                return;
            }

            await Container.update({ id: container.id }, update).catch(() => undefined);
        }));
    }

    async #resolveInternalIp(teamClusterId: string, runtimeContainerId: string): Promise<string | undefined>{
        const runtimeInfo = await daemonContainerRuntimeService.getContainer(teamClusterId, runtimeContainerId).catch(() => null);
        return runtimeInfo ? resolveNonPlaceholderInternalIp(runtimeInfo) : undefined;
    }
}

export default new ContainerRuntimeStatusSynchronizer();

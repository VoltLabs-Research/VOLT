import Container from '@modules/container/models/Container';
import daemonContainerRuntimeService from '@modules/container/services/DaemonContainerRuntimeService';
import containerRuntimeStatusSynchronizer from '@modules/container/services/ContainerRuntimeStatusSynchronizer';
import { requireTeamContainer } from '@modules/container/services/container-lookup';
import { resolveAccessiblePorts } from '@modules/container/services/container-network';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderService from '@shared/domain/catalog/CatalogFolderService';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { ILike, IsNull } from 'typeorm';
import type { FindManyOptions, FindOptionsWhere } from 'typeorm';


const DEFAULT_LIST_LIMIT = 100;

const LIST_REFERENCE_OPTIONS = {
    relations: {
        createdByRef: true,
        teamClusterRef: true
    },
    select: {
        createdByRef: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true
        },
        teamClusterRef: {
            id: true,
            name: true
        }
    }
} satisfies FindManyOptions<Container>;

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

interface ContainerListQuery {
    folderId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export default class ContainerService{
    readonly #folders = new CatalogFolderService(CatalogFolderKind.Container);

    async list(teamId: string, query: ContainerListQuery): Promise<PaginatedResult<Record<string, unknown>>>{
        const pageRequest = readPageRequest(Number(query.page), Number(query.limit), { defaultLimit: DEFAULT_LIST_LIMIT });
        const where: FindOptionsWhere<Container> = { team: teamId };

        if(query.folderId === 'root'){
            where.folder = IsNull();
        }else if(query.folderId){
            where.folder = query.folderId;
        }

        if(query.search){
            where.name = ILike(`%${escapeLikePattern(query.search)}%`);
        }

        const [containers, total] = await Container.findAndCount({
            where,
            ...LIST_REFERENCE_OPTIONS,
            order: { updatedAt: 'DESC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        });

        containerRuntimeStatusSynchronizer.schedule(containers);

        const data = containers.map((container) => ({
            ...container.toJSON(),
            accessiblePorts: resolveAccessiblePorts(container.ports, container.status)
        }));

        return paginate([data, total], pageRequest);
    }

    async getById(teamId: string, containerId: string): Promise<{ container: Record<string, unknown> }>{
        const container = await requireTeamContainer(containerId, teamId);
        const teamClusterId = container.teamCluster || undefined;

        if(teamClusterId){
            const runtimeContainer = await daemonContainerRuntimeService.getContainer(teamClusterId, container.containerId);
            if(runtimeContainer.State?.Status){
                container.status = runtimeContainer.State.Status;
            }
        }

        return {
            container: {
                ...container.toJSON(),
                accessiblePorts: resolveAccessiblePorts(container.ports, container.status)
            }
        };
    }

    async move(teamId: string, containerId: string, folderId: string | null): Promise<null>{
        const container = await requireTeamContainer(containerId, teamId);

        if(folderId !== null){
            await this.#folders.require(teamId, folderId, 'Target Container folder not found');
        }

        container.folder = folderId;
        await container.save();
        return null;
    }
}

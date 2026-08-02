import { ErrorCodes } from '@core/constants/error-codes';
import Container from '@modules/container/models/Container';
import { deleteContainer } from '@modules/container/services/container-provisioning';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderService from '@shared/domain/catalog/CatalogFolderService';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type {
    CreateContainerFolderInput,
    UpdateContainerFolderInput
} from '@volt/contracts/modules/container/http';

/* The container folder tree. Storage and traversal are generic (CatalogFolder);
   what is container-specific is cascade deletion, since removing a folder has
   to remove the containers it holds through the full container teardown path. */

type ContainerFolderView = Awaited<ReturnType<CatalogFolderService['get']>>;

interface ContainerFolderQuery{
    parentId?: string | null;
    page?: number;
    limit?: number;
}

export class ContainerFolderService{
    readonly #folders = new CatalogFolderService(CatalogFolderKind.Container);

    async list(teamId: string, query: ContainerFolderQuery): Promise<PaginatedResult<ContainerFolderView>>{
        return this.#folders.list(teamId, {
            parentId: query.parentId,
            page: Number(query.page),
            limit: Number(query.limit)
        });
    }

    async get(teamId: string, folderId: string): Promise<ContainerFolderView>{
        return this.#folders.get(teamId, folderId, 'Container folder not found');
    }

    async create(teamId: string, userId: string, input: CreateContainerFolderInput): Promise<ContainerFolderView>{
        return this.#folders.create(teamId, userId, {
            title: input.title,
            parentId: input.parentId || null
        });
    }

    async update(teamId: string, folderId: string, input: UpdateContainerFolderInput): Promise<ContainerFolderView>{
        return this.#folders.update(teamId, folderId, input.title);
    }

    async delete(teamId: string, folderId: string, userId: string): Promise<null>{
        try{
            await this.#folders.require(teamId, folderId, 'Container folder not found');
            await this.#folders.removeTree(teamId, folderId, (id) => this.#deleteContainersInFolder(teamId, id, userId));
            return null;
        }catch(error){
            if(error instanceof ApplicationError){
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete Container folder', 500);
        }
    }

    async #deleteContainersInFolder(teamId: string, folderId: string, userId: string): Promise<void>{
        const containers = await Container.find({
            where: {
                team: teamId,
                folder: folderId
            },
            select: { id: true }
        });
        for(const container of containers){
            await deleteContainer(teamId, container.id, userId);
        }
    }
}

export default new ContainerFolderService();

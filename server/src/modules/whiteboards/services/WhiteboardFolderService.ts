import { ErrorCodes } from '@core/constants/error-codes';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { IsNull } from 'typeorm';

const DEFAULT_LIST_LIMIT = 500;

const presentFolder = (folder: CatalogFolder) => ({
    _id: folder.id,
    title: folder.title,
    parent: folder.parent,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
});

/** The whiteboard-kind slice of the shared catalog folder tree. */
export default class WhiteboardFolderService{
    #whiteboards = new WhiteboardService();

    async listFolders(teamId: string, query: { parentId?: string | null; page?: number; limit?: number }){
        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: DEFAULT_LIST_LIMIT });
        const [folders, total] = await CatalogFolder.findAndCount({
            where: {
                team: teamId,
                kind: CatalogFolderKind.Whiteboard,
                parent: query.parentId ?? IsNull()
            },
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([folders.map(presentFolder), total], pageRequest);
    }

    async getFolder(teamId: string, folderId: string){
        return presentFolder(await this.#getOwned(teamId, folderId));
    }

    async createFolder(teamId: string, userId: string, input: { title: string; parentId?: string | null }){
        const folder = await CatalogFolder.create({
            team: teamId,
            createdBy: userId,
            title: input.title,
            parent: input.parentId || null,
            kind: CatalogFolderKind.Whiteboard
        }).save();
        return presentFolder(folder);
    }

    async updateFolder(teamId: string, folderId: string, input: { title: string }){
        const folder = await this.#getOwned(teamId, folderId);
        folder.title = input.title;
        await folder.save();
        return presentFolder(folder);
    }

    async deleteFolder(teamId: string, folderId: string, userId: string): Promise<void>{
        await this.#getOwned(teamId, folderId);
        await this.#deleteTree(teamId, folderId, userId);
    }

    async #getOwned(teamId: string, folderId: string): Promise<CatalogFolder>{
        const folder = await CatalogFolder.findOneBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Whiteboard
        });
        if(!folder){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard folder not found');
        }
        return folder;
    }

    async #deleteTree(teamId: string, folderId: string, userId: string): Promise<void>{
        const subfolders = await CatalogFolder.findBy({
            team: teamId,
            parent: folderId,
            kind: CatalogFolderKind.Whiteboard
        });
        for(const subfolder of subfolders){
            await this.#deleteTree(teamId, subfolder.id, userId);
        }

        const whiteboards = await Whiteboard.find({
            where: {
                team: teamId,
                folder: folderId
            },
            select: { id: true }
        });
        for(const whiteboard of whiteboards){
            await this.#whiteboards.deleteWhiteboard(teamId, whiteboard.id, userId);
        }

        await CatalogFolder.delete({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Whiteboard
        });
    }
}

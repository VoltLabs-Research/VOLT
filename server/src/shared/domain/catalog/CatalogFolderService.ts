import { ErrorCodes } from '@core/constants/error-codes';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';

import type { PaginatedResult } from '@shared/domain/port/persistence';
import { IsNull } from 'typeorm';

interface CatalogFolderView{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface CatalogFolderQuery{
    parentId?: string | null;
    page?: number;
    limit?: number;
}

const DEFAULT_FOLDER_LIMIT = 500;

const toCatalogFolderView = (folder: CatalogFolder): CatalogFolderView => ({
    _id: folder.id,
    title: folder.title,
    parent: folder.parent ? String(folder.parent) : null,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
});

export default class CatalogFolderService{
    #kind: CatalogFolderKind;

    constructor(kind: CatalogFolderKind){
        this.#kind = kind;
    }

    async list(teamId: string, query: CatalogFolderQuery = {}): Promise<PaginatedResult<CatalogFolderView>>{
        const pageRequest = readPageRequest(query.page, query.limit, { defaultLimit: DEFAULT_FOLDER_LIMIT });

        const [folders, total] = await CatalogFolder.findAndCount({
            where: {
                team: teamId,
                kind: this.#kind,
                parent: query.parentId ?? IsNull()
            },
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([folders.map(toCatalogFolderView), total], pageRequest);
    }

    async require(teamId: string, folderId: string, message = 'Folder not found'): Promise<CatalogFolder>{
        const folder = await CatalogFolder.findOneBy({
            id: folderId,
            team: teamId,
            kind: this.#kind
        });
        if(!folder) throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, message);
        return folder;
    }

    async get(teamId: string, folderId: string, message?: string): Promise<CatalogFolderView>{
        return toCatalogFolderView(await this.require(teamId, folderId, message));
    }

    async create(teamId: string, userId: string, input: { title: string; parentId?: string | null }): Promise<CatalogFolderView>{
        const folder = await CatalogFolder.create({
            team: teamId,
            createdBy: userId,
            title: input.title,
            parent: input.parentId ?? null,
            kind: this.#kind
        }).save();

        return toCatalogFolderView(folder);
    }

    async update(teamId: string, folderId: string, title: string): Promise<CatalogFolderView>{
        const folder = await this.require(teamId, folderId);
        const updated = await Object.assign(folder, {
            title,
            updatedAt: new Date()
        }).save();

        return toCatalogFolderView(updated);
    }

    subfolders(teamId: string, parentId: string): Promise<CatalogFolder[]>{
        return CatalogFolder.findBy({
            team: teamId,
            parent: parentId,
            kind: this.#kind
        });
    }

    async remove(teamId: string, folderId: string): Promise<void>{
        await CatalogFolder.delete({
            id: folderId,
            team: teamId,
            kind: this.#kind
        });
    }

    async removeTree(teamId: string, folderId: string, removeItems: (folderId: string) => Promise<void>): Promise<void>{
        for(const subfolder of await this.subfolders(teamId, folderId)){
            await this.removeTree(teamId, subfolder.id, removeItems);
        }

        await removeItems(folderId);
        await this.remove(teamId, folderId);
    }
}

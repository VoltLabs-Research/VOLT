import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { Document } from 'mongoose';

export abstract class MongooseCatalogFolderRepository<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TDocument extends Document
> extends MongooseBaseRepository<TFolder, TFolderProps, TDocument> implements ICatalogFolderRepository<TFolder, TFolderProps> {
    async findAllByTeamAndParent(
        teamId: string,
        parentId: string | null,
        options: PaginationOptions
    ): Promise<PaginatedResult<TFolder>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;
        const filter = { team: teamId, parent: parentId } as Partial<TFolderProps>;

        return this.findAll({
            filter,
            page,
            limit,
            skip,
            sort: { createdAt: -1 }
        });
    }

    async findByTeamAndFolderId(teamId: string, folderId: string): Promise<TFolder | null> {
        return this.findOne({
            _id: folderId,
            team: teamId
        } as unknown as Partial<TFolderProps>);
    }
}

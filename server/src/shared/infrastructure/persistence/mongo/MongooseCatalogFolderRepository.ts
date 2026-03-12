import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type { FindOptions, PaginatedResult, PaginationOptions, RepositoryFilter } from '@shared/domain/port/IBaseRepository';
import type { IMapper } from '@shared/infrastructure/persistence/IMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { Document, Model } from 'mongoose';

export abstract class MongooseCatalogFolderRepository<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TDocument extends Document
> extends MongooseBaseRepository<TFolder, TFolderProps, TDocument> implements ICatalogFolderRepository<TFolder, TFolderProps> {
    constructor(
        model: Model<TDocument>,
        mapper: IMapper<TFolder, TFolderProps, TDocument>,
        private readonly kind: CatalogFolderKind
    ) {
        super(model, mapper);
    }

    private withKind<TFilter extends Record<string, unknown> | undefined>(filter?: TFilter): TFilter & { kind: CatalogFolderKind } {
        return {
            ...(filter ?? {}),
            kind: this.kind
        } as TFilter & { kind: CatalogFolderKind };
    }

    async findAllByTeamAndParent(
        teamId: string,
        parentId: string | null,
        options: PaginationOptions
    ): Promise<PaginatedResult<TFolder>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;
        const filter = this.withKind({ team: teamId, parent: parentId } as Partial<TFolderProps>);

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
            team: teamId,
            kind: this.kind
        } as unknown as Partial<TFolderProps>);
    }

    async findById(id: string, options?: Pick<FindOptions<TFolderProps>, 'populate' | 'select'>): Promise<TFolder | null> {
        return this.findOne({ _id: id } as RepositoryFilter<TFolderProps>, options);
    }

    async findOne(filter: RepositoryFilter<TFolderProps>, options?: Pick<FindOptions<TFolderProps>, 'populate' | 'select'>): Promise<TFolder | null> {
        return super.findOne(this.withKind(filter), options);
    }

    async findAll(options: FindOptions<TFolderProps> & PaginationOptions = {}): Promise<PaginatedResult<TFolder>> {
        return super.findAll({
            ...options,
            filter: this.withKind(options.filter)
        });
    }

    async create(data: TFolderProps): Promise<TFolder> {
        return super.create({
            ...data,
            kind: this.kind
        } as TFolderProps);
    }

    async updateById(id: string, data: Partial<TFolderProps>, options?: Pick<FindOptions<TFolderProps>, 'populate' | 'select'>): Promise<TFolder | null> {
        return this.findOneAndUpdate(
            { _id: id },
            data,
            options
        );
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.deleteOne(this.withKind({ _id: id } as RepositoryFilter<TFolderProps>));
        return result.deletedCount > 0;
    }

    async count(filter?: RepositoryFilter<TFolderProps>): Promise<number> {
        return super.count(this.withKind(filter));
    }

    async updateMany(filter: RepositoryFilter<TFolderProps>, data: Partial<TFolderProps>): Promise<number> {
        return super.updateMany(this.withKind(filter), data);
    }

    async deleteMany(filter: RepositoryFilter<TFolderProps>): Promise<number> {
        return super.deleteMany(this.withKind(filter));
    }

    async exists(filter: RepositoryFilter<TFolderProps>): Promise<boolean> {
        return super.exists(this.withKind(filter));
    }

    private async findOneAndUpdate(
        filter: RepositoryFilter<TFolderProps>,
        data: Partial<TFolderProps>,
        options?: Pick<FindOptions<TFolderProps>, 'populate' | 'select'>
    ): Promise<TFolder | null> {
        const mergedFilter = this.withKind(filter);
        const existing = await this.findOne(mergedFilter, options);
        if (!existing) return null;
        return super.updateById((existing as { _id: string })._id, data, options);
    }
}

import { Model, Document } from 'mongoose';
import { IBaseRepository, PaginationOptions, FindOptions } from '@shared/domain/ports/IBaseRepository';
import { IMapper } from '@shared/infrastructure/persistence/IMapper';

export abstract class MongooseBaseRepository<TDomain, TProps, TDocument extends Document> implements IBaseRepository<TDomain, TProps> {
    constructor(
        protected readonly model: Model<TDocument>,
        protected readonly mapper: IMapper<TDomain, TProps, TDocument>
    ){}

    async findById(id: string, options?: Pick<FindOptions<TProps>, 'populate' | 'select'>): Promise<TDomain | null> {
        let query = this.model.findById(id);
        if (options?.populate) query = query.populate(options.populate as any);
        if (options?.select) query = query.select(options.select.join(' '));
        const doc = await query.exec();
        return doc ? this.mapper.toDomain(doc as TDocument) : null;
    }

    async findOne(filter: Partial<TProps>, options?: Pick<FindOptions<TProps>, 'populate' | 'select'>): Promise<TDomain | null> {
        let query = this.model.findOne(filter as any);
        if (options?.populate) query = query.populate(options.populate as any);
        if (options?.select) query = query.select(options.select.join(' '));
        const doc = await query.exec();
        return doc ? this.mapper.toDomain(doc as TDocument) : null;
    }

    async findAll(options: FindOptions<TProps> & PaginationOptions): Promise<any> {
        const { page = 1, limit = 10, filter = {}, populate, select, sort } = options;
        const skip = (page - 1) * limit;

        let query = this.model.find(filter as any).skip(skip).limit(limit);

        if (populate) query = query.populate(populate as any);
        if (select) query = query.select(select.join(' '));
        if (sort) query = query.sort(sort as any);

        const [docs, total] = await Promise.all([
            query.exec(),
            this.model.countDocuments(filter as any)
        ]);

        return {
            data: docs.map((doc) => this.mapper.toDomain(doc as TDocument)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async create(data: TProps): Promise<TDomain> {
        const persistenceData = this.mapper.toPersistence(data);
        const doc = await this.model.create(persistenceData);
        return this.mapper.toDomain(doc);
    }

    async updateById(id: string, data: Partial<TProps>, options?: Pick<FindOptions<TProps>, 'populate' | 'select'>): Promise<TDomain | null> {
        let query = this.model.findByIdAndUpdate(id, data as any, { new: true });
        if (options?.populate) query = query.populate(options.populate as any);
        if (options?.select) query = query.select(options.select.join(' '));
        const doc = await query.exec();
        return doc ? this.mapper.toDomain(doc as TDocument) : null;
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);
        return !!result;
    }

    async count(filter?: Partial<TProps>): Promise<number> {
        return this.model.countDocuments(filter);
    }

    async updateMany(filter: Partial<TProps>, data: Partial<TProps>): Promise<number> {
        const result = await this.model.updateMany(filter, data as any);
        return result.modifiedCount;
    }

    async insertMany(data: Partial<TProps>): Promise<void>{
        await this.model.insertMany(data);
    }

    async deleteMany(filter: Partial<TProps>): Promise<number> {
        const result = await this.model.deleteMany(filter);
        return result.deletedCount;
    }

    async exists(filter: Partial<TProps>): Promise<boolean> {
        const count = await this.model.countDocuments(filter);
        return count > 0;
    }
};
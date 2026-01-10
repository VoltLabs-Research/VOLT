import { Model, Document } from 'mongoose';
import { IBaseRepository, PaginationOptions } from '@/src/shared/domain/IBaseRepository';
import { IMapper } from '../IMapper';

export abstract class MongooseBaseRepository<TDomain, TProps, TDocument extends Document> implements IBaseRepository<TDomain, TProps>{
    constructor(
        protected readonly model: Model<TDocument>,
        protected readonly mapper: IMapper<TDomain, TProps, TDocument>
    ){}

    async findById(id: string): Promise<TDomain | null>{
        const doc = await this.model.findById(id);
        return doc ? this.mapper.toDomain(doc) : null;
    }

    async findOne(filter: Partial<TProps>): Promise<TDomain | null>{
        const doc = await this.model.findOne(filter);
        return doc ? this.mapper.toDomain(doc) : null;
    }

    async findAll(options: PaginationOptions): Promise<any>{
        const { page, limit } = options;
        const skip = (page - 1) * limit;
        
        const [docs, total] = await Promise.all([
            this.model.find().skip(skip).limit(limit),
            this.model.countDocuments()
        ]);

        return {
            data: docs.map((doc) => this.mapper.toDomain(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async create(data: TProps): Promise<TDomain>{
        const persistenceData = this.mapper.toPersistence(data);
        const doc = await this.model.create(persistenceData);
        return this.mapper.toDomain(doc);
    }

    async updateById(id: string, data: Partial<TProps>): Promise<TDomain | null>{
        const doc = await this.model.findByIdAndUpdate(id, data as any, { new: true });
        return doc ? this.mapper.toDomain(doc) : null;
    }

    async deleteById(id: string): Promise<boolean>{
        const result = await this.model.findByIdAndDelete(id);
        return !!result;
    }

    async count(filter?: Partial<TProps>): Promise<number>{
        return this.model.countDocuments(filter);
    }

    async updateMany(filter: Partial<TProps>, data: Partial<TProps>): Promise<number>{
        const result = await this.model.updateMany(filter, data as any);
        return result.modifiedCount;
    }

    async deleteMany(filter: Partial<TProps>): Promise<number>{
        const result = await this.model.deleteMany(filter);
        return result.deletedCount;
    }

    async exists(filter: Partial<TProps>): Promise<boolean>{
        const count = await this.model.countDocuments(filter);
        return count > 0;
    }
};
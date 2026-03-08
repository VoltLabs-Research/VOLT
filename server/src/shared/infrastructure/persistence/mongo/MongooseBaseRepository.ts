import type {
    Document,
    FilterQuery,
    Model,
    PopulateOptions,
    ProjectionType,
    SortOrder,
    UpdateQuery
} from 'mongoose';
import type {
    IBaseRepository,
    PaginationOptions,
    FindOptions,
    PaginatedResult,
    PopulatePath
} from '@shared/domain/port/IBaseRepository';
import type { IMapper } from '@shared/infrastructure/persistence/IMapper';

type PopulateInput = string | string[] | PopulatePath | PopulatePath[];

const toFilterQuery = <TDocument extends Document, TProps>(
    filter?: Partial<TProps>
): FilterQuery<TDocument> => {
    return (filter ?? {}) as unknown as FilterQuery<TDocument>;
};

const toPopulate = (populate?: PopulateInput): PopulateOptions | Array<string | PopulateOptions> | undefined => {
    return populate as unknown as PopulateOptions | Array<string | PopulateOptions> | undefined;
};

const toProjection = (select?: string[]): ProjectionType<unknown> | undefined => {
    if (!select?.length) {
        return undefined;
    }

    return select.join(' ');
};

const toSort = (sort?: Record<string, 1 | -1>): Record<string, SortOrder> | undefined => {
    return sort as Record<string, SortOrder> | undefined;
};

const toUpdateQuery = <TDocument extends Document, TProps>(
    data: Partial<TProps>
): UpdateQuery<TDocument> => {
    return data as unknown as UpdateQuery<TDocument>;
};

export abstract class MongooseBaseRepository<TDomain, TProps, TDocument extends Document> implements IBaseRepository<TDomain, TProps> {
    constructor(
        protected readonly model: Model<TDocument>,
        protected readonly mapper: IMapper<TDomain, TProps, TDocument>
    ){}

    async findById(id: string, options?: Pick<FindOptions<TProps>, 'populate' | 'select'>): Promise<TDomain | null> {
        let query = this.model.findById(id) as ReturnType<typeof this.model.findById>;
        const populate = toPopulate(options?.populate);
        const projection = toProjection(options?.select);

        if (populate) query = query.populate(populate);
        if (projection) query = query.select(projection);

        const doc = await query.exec();
        return doc ? this.mapper.toDomain(doc as TDocument) : null;
    }

    async findOne(filter: Partial<TProps>, options?: Pick<FindOptions<TProps>, 'populate' | 'select'>): Promise<TDomain | null> {
        let query = this.model.findOne(toFilterQuery<TDocument, TProps>(filter)) as ReturnType<typeof this.model.findOne>;
        const populate = toPopulate(options?.populate);
        const projection = toProjection(options?.select);

        if (populate) query = query.populate(populate);
        if (projection) query = query.select(projection);

        const doc = await query.exec();
        return doc ? this.mapper.toDomain(doc as TDocument) : null;
    }

    async findAll(options: FindOptions<TProps> & PaginationOptions = {}): Promise<PaginatedResult<TDomain>> {
        const {
            page = 1,
            limit = 100,
            skip,
            filter = {},
            populate,
            select,
            sort
        } = options;
        const normalizedSkip = skip ?? (page - 1) * limit;
        const projection = toProjection(select);
        const populateOptions = toPopulate(populate);
        const sortOptions = toSort(sort);
        const filterQuery = toFilterQuery<TDocument, TProps>(filter);

        let query = this.model.find(filterQuery).skip(normalizedSkip).limit(limit) as ReturnType<typeof this.model.find>;

        if (populateOptions) query = query.populate(populateOptions);
        if (projection) query = query.select(projection);
        if (sortOptions) query = query.sort(sortOptions);

        const [docs, total] = await Promise.all([
            query.exec(),
            this.model.countDocuments(filterQuery)
        ]);

        const currentPage = Math.floor(normalizedSkip / limit) + 1;

        return {
            data: docs.map((doc) => this.mapper.toDomain(doc as TDocument)),
            total,
            page: currentPage,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async export(options: Omit<FindOptions<TProps>, 'limit' | 'skip'> = {}): Promise<TDomain[]> {
        const { filter = {}, populate, select, sort } = options;
        const filterQuery = toFilterQuery<TDocument, TProps>(filter);
        const projection = toProjection(select);
        const populateOptions = toPopulate(populate);
        const sortOptions = toSort(sort);

        let query = this.model.find(filterQuery) as ReturnType<typeof this.model.find>;

        if (populateOptions) query = query.populate(populateOptions);
        if (projection) query = query.select(projection);
        if (sortOptions) query = query.sort(sortOptions);

        const docs = await query.exec();
        return docs.map((doc) => this.mapper.toDomain(doc as TDocument));
    }

    async create(data: TProps): Promise<TDomain> {
        const persistenceData = this.mapper.toPersistence(data);
        const doc = await this.model.create(persistenceData);
        return this.mapper.toDomain(doc);
    }

    async updateById(id: string, data: Partial<TProps>, options?: Pick<FindOptions<TProps>, 'populate' | 'select'>): Promise<TDomain | null> {
        const persistenceData = this.mapper.toPersistence(data as TProps);
        let query = this.model.findByIdAndUpdate(id, toUpdateQuery<TDocument, TProps>(persistenceData as Partial<TProps>), { new: true }) as ReturnType<typeof this.model.findByIdAndUpdate>;
        const populate = toPopulate(options?.populate);
        const projection = toProjection(options?.select);

        if (populate) query = query.populate(populate);
        if (projection) query = query.select(projection);

        const doc = await query.exec();
        return doc ? this.mapper.toDomain(doc as TDocument) : null;
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);
        return !!result;
    }

    async count(filter?: Partial<TProps>): Promise<number> {
        return this.model.countDocuments(toFilterQuery<TDocument, TProps>(filter));
    }

    async updateMany(filter: Partial<TProps>, data: Partial<TProps>): Promise<number> {
        const result = await this.model.updateMany(
            toFilterQuery<TDocument, TProps>(filter),
            toUpdateQuery<TDocument, TProps>(data)
        );
        return result.modifiedCount;
    }

    async insertMany(data: Partial<TProps> | Array<Partial<TProps>>): Promise<void>{
        const documents = Array.isArray(data)
            ? data
            : [data];

        await this.model.insertMany(documents);
    }

    async deleteMany(filter: Partial<TProps>): Promise<number> {
        const result = await this.model.deleteMany(toFilterQuery<TDocument, TProps>(filter));
        return result.deletedCount;
    }

    async countGroupedBy(
        field: string,
        fieldValues: string[]
    ): Promise<Map<string, number>> {
        const results = await this.model.aggregate<{ _id: string; count: number }>([
            { $match: { [field]: { $in: fieldValues } } },
            { $group: { _id: `$${field}`, count: { $sum: 1 } } }
        ]);
        const map = new Map<string, number>();
        for (const row of results) {
            map.set(row._id.toString(), row.count);
        }
        return map;
    }

    async exists(filter: Partial<TProps>): Promise<boolean> {
        return !!(await this.model.exists(toFilterQuery<TDocument, TProps>(filter)));
    }
};

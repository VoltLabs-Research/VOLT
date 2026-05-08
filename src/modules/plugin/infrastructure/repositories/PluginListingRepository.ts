import { Factory } from '@/core/decorators/service';
import { PluginListingRowModel } from '@/modules/plugin/domain/models/plugin-listing-row-model';
import { PluginSubListingRowModel } from '@/modules/plugin/domain/models/plugin-sub-listing-row-model';
import { calculatePaginationOffset, calculateTotalPages, normalizePagination } from '@/support/contracts/pagination';
import { isRecord } from '@/support/type-guards/is-record';
import type { PluginListingRowDocument } from '@/modules/plugin/domain/models/plugin-listing-row-model';
import type { PluginSubListingRowDocument } from '@/modules/plugin/domain/models/plugin-sub-listing-row-model';
import type { PaginatedResult } from '@/support/contracts/pagination';
import type {
    BulkUpsertOperation,
    ListingPaginatedResult,
    PluginListingFilter,
    PluginListingRepository,
    PluginMongoRow,
    PluginMongoRowsExportInput,
    PluginMongoRowsExportResult,
    PluginMongoRowsImportInput,
    PluginMongoRowsPurgeInput,
    PluginSubListingFilter,
    ReplaceSubListingRowsInput
} from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';

type ImportableMongoRow = PluginMongoRow & {
    _id: string;
};

type PluginListingPageDocument = PluginListingRowDocument & {
    row?: PluginMongoRow;
    subListingNames?: string[];
};

interface PluginListingQuery {
    plugin?: string;
    trajectory?: string;
    analysis?: string;
    exposureId?: string;
    exposureName?: string;
}

interface PluginSubListingQuery {
    analysis?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
};

interface PagedDocumentsRequest<TDocument> {
    page: number;
    limit: number;
    count(): Promise<number>;
    read(skip: number, limit: number): Promise<TDocument[]>;
};

interface PagedDocumentsResult<TDocument> {
    documents: TDocument[];
    page: number;
    limit: number;
    total: number;
};

const readPagedDocuments = async <TDocument>(input: PagedDocumentsRequest<TDocument>): Promise<PagedDocumentsResult<TDocument>> => {
    const pagination = normalizePagination(input.page, input.limit);
    const skip = calculatePaginationOffset(pagination.page, pagination.limit);
    const [total, documents] = await Promise.all([
        input.count(),
        input.read(skip, pagination.limit)
    ]);

    return {
        documents,
        page: pagination.page,
        limit: pagination.limit,
        total
    };
};

const SYSTEM_KEYS = new Set([
    '_id',
    'plugin',
    'team',
    'trajectory',
    'analysis',
    'exposureId',
    'exposureName',
    'timestep',
    'propertyObjectKey',
    'subListingNames',
    '__v',
    'row'
]);

const normalizeAnalysisIds = (analysisIds: string[]): string[] => {
    return [...new Set(analysisIds.filter((analysisId) => analysisId.length > 0))];
};

export class MongoPluginListingRepository implements PluginListingRepository {
    async listPluginListings(filter: PluginListingFilter): Promise<ListingPaginatedResult> {
        const query: PluginListingQuery = {};

        if (filter.pluginId) {
            query.plugin = filter.pluginId;
        }

        if (filter.trajectoryId) {
            query.trajectory = filter.trajectoryId;
        }

        if (filter.analysisId) {
            query.analysis = filter.analysisId;
        }

        if (filter.exposureId) {
            query.exposureId = filter.exposureId;
        }

        if (filter.exposureName) {
            query.exposureName = filter.exposureName;
        }

        const pageResult = await readPagedDocuments<PluginListingPageDocument>({
            page: filter.page,
            limit: filter.limit,
            count: () => PluginListingRowModel.countDocuments(query),
            read: (skip, limit) => PluginListingRowModel.find(query)
                .sort({
                    timestep: -1,
                    _id: -1
                })
                .skip(skip)
                .limit(limit)
                .lean<PluginListingPageDocument[]>()
                .exec()
        });
        const documents = pageResult.documents;
        const columns = new Set<string>();
        let subListingNames: string[] = [];

        for (const document of documents) {
            const rowData = document.row;

            if (isRecord(rowData)) {
                for (const key of Object.keys(rowData)) {
                    columns.add(key);
                }
            } else {
                for (const key of Object.keys(document)) {
                    if (!SYSTEM_KEYS.has(key)) {
                        columns.add(key);
                    }
                }
            }

            if (subListingNames.length === 0 && document.subListingNames?.length) {
                subListingNames = document.subListingNames;
            }
        }

        return {
            data: documents,
            page: pageResult.page,
            limit: pageResult.limit,
            total: pageResult.total,
            totalPages: calculateTotalPages(pageResult.total, pageResult.limit),
            columns: Array.from(columns),
            subListingNames
        };
    }

    async listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>> {
        const query: PluginSubListingQuery = {};

        if (filter.analysisId) {
            query.analysis = filter.analysisId;
        }

        if (filter.exposureId) {
            query.exposureId = filter.exposureId;
        }

        if (filter.timestep !== undefined) {
            query.timestep = filter.timestep;
        }

        if (filter.subListingName) {
            query.subListingName = filter.subListingName;
        }

        const pageResult = await readPagedDocuments<PluginSubListingRowDocument>({
            page: filter.page,
            limit: filter.limit,
            count: () => PluginSubListingRowModel.countDocuments(query),
            read: (skip, limit) => PluginSubListingRowModel.find(query)
                .sort({
                    timestep: -1,
                    _id: -1
                })
                .skip(skip)
                .limit(limit)
                .lean<PluginSubListingRowDocument[]>()
                .exec()
        });

        return {
            data: pageResult.documents,
            page: pageResult.page,
            limit: pageResult.limit,
            total: pageResult.total,
            totalPages: calculateTotalPages(pageResult.total, pageResult.limit)
        };
    }

    async bulkUpsertListingRows(operations: BulkUpsertOperation[]): Promise<void> {
        if (operations.length === 0) {
            return;
        }

        const bulkOperations = operations.map((operation) => ({
            updateOne: {
                filter: operation.filter,
                update: {
                    $set: operation.update
                },
                upsert: true
            }
        }));

        await PluginListingRowModel.bulkWrite(bulkOperations);
    }

    async replaceSubListingRows(inputs: ReplaceSubListingRowsInput[]): Promise<void> {
        if (inputs.length === 0) {
            return;
        }

        await Promise.all(inputs.map((input) => PluginSubListingRowModel.deleteMany({
            analysis: input.analysis,
            exposureId: input.exposureId,
            timestep: input.timestep,
            subListingName: input.subListingName
        })));

        const bulkOperations = inputs.flatMap((input) => input.rows.map((row, index) => ({
            replaceOne: {
                filter: {
                    _id: `${input.analysis}:${input.exposureId}:${input.timestep}:${input.subListingName}:${index}`
                },
                replacement: {
                    _id: `${input.analysis}:${input.exposureId}:${input.timestep}:${input.subListingName}:${index}`,
                    analysis: input.analysis,
                    exposureId: input.exposureId,
                    timestep: input.timestep,
                    subListingName: input.subListingName,
                    row
                },
                upsert: true
            }
        })));

        if (bulkOperations.length > 0) {
            await PluginSubListingRowModel.bulkWrite(bulkOperations);
        }
    }

    async exportMongoRows(input: PluginMongoRowsExportInput): Promise<PluginMongoRowsExportResult> {
        const analysisIds = normalizeAnalysisIds(input.analysisIds);
        const skip = Math.max(0, input.skip ?? 0);
        const limit = Math.min(500, Math.max(1, input.limit ?? 200));

        if (analysisIds.length === 0) {
            return {
                rows: [],
                total: 0,
                hasMore: false,
                nextSkip: skip
            };
        }

        const query = {
            analysis: {
                $in: analysisIds
            }
        };

        if (input.documentType === 'listing') {
            const [total, rows] = await Promise.all([
                PluginListingRowModel.countDocuments(query),
                PluginListingRowModel.find(query)
                    .sort({
                        _id: 1
                    })
                    .skip(skip)
                    .limit(limit)
                    .lean<PluginMongoRow[]>()
            ]);

            return {
                rows,
                total,
                hasMore: skip + rows.length < total,
                nextSkip: skip + rows.length
            };
        }

        const [total, rows] = await Promise.all([
            PluginSubListingRowModel.countDocuments(query),
            PluginSubListingRowModel.find(query)
                .sort({
                    _id: 1
                })
                .skip(skip)
                .limit(limit)
                .lean<PluginMongoRow[]>()
        ]);

        return {
            rows,
            total,
            hasMore: skip + rows.length < total,
            nextSkip: skip + rows.length
        };
    }

    async importMongoRows(input: PluginMongoRowsImportInput): Promise<number> {
        const rows = input.rows
            .filter((row): row is ImportableMongoRow => typeof row._id === 'string' && row._id.length > 0)
            .map((row) => ({ ...row }));
        if (rows.length === 0) {
            return 0;
        }

        const bulkOperations = rows.map((row) => ({
            replaceOne: {
                filter: {
                    _id: row._id
                },
                replacement: row,
                upsert: true
            }
        }));

        if (input.documentType === 'listing') {
            await PluginListingRowModel.bulkWrite(bulkOperations);
            return rows.length;
        }

        await PluginSubListingRowModel.bulkWrite(bulkOperations);
        return rows.length;
    }

    async purgeMongoRows(input: PluginMongoRowsPurgeInput): Promise<number> {
        const analysisIds = normalizeAnalysisIds(input.analysisIds);
        if (analysisIds.length === 0) {
            return 0;
        }

        const query = {
            analysis: {
                $in: analysisIds
            }
        };

        if (input.documentType === 'listing') {
            const result = await PluginListingRowModel.deleteMany(query);
            return result.deletedCount ?? 0;
        }

        const result = await PluginSubListingRowModel.deleteMany(query);
        return result.deletedCount ?? 0;
    }
};

export const createPluginListingRepository = Factory('pluginListingRepository')((): PluginListingRepository => {
    return new MongoPluginListingRepository();
});

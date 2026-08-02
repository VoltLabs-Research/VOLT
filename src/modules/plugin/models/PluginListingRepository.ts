import { singleton } from '@shared/application/utilities/singleton';
import type { Model } from 'mongoose';
import { PluginListingRowModel } from '@modules/plugin/models/plugin-listing-row-model';
import { PluginSubListingRowModel } from '@modules/plugin/models/plugin-sub-listing-row-model';
import { calculatePaginationOffset, calculateTotalPages, normalizePagination } from '@shared/contracts/types/pagination';
import type { PluginListingRowDocument } from '@modules/plugin/models/plugin-listing-row-model';
import type { PluginSubListingRowDocument } from '@modules/plugin/models/plugin-sub-listing-row-model';
import type { PaginatedResult } from '@shared/contracts/types/pagination';
import type {
    TeamClusterDaemonPluginMongoDocumentType,
    TeamClusterDaemonPluginMongoExportPayload,
    TeamClusterDaemonPluginMongoImportPayload,
    TeamClusterDaemonPluginMongoPurgePayload
} from '@shared/contracts';
import type {
    BulkUpsertOperation,
    ListingPaginatedResult,
    PluginListingFilter,
    PluginMongoRow,
    PluginMongoRowsExportResult,
    PluginSubListingFilter,
    ReplaceSubListingRowsInput
} from '@modules/plugin/models/plugin-listing-repository-contract';

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
}

const readPagedDocuments = async <TDocument>(input: {
    page: number;
    limit: number;
    count(): Promise<number>;
    read(skip: number, limit: number): Promise<TDocument[]>;
}): Promise<PaginatedResult<TDocument>> => {
    const pagination = normalizePagination(input.page, input.limit);
    const skip = calculatePaginationOffset(pagination.page, pagination.limit);
    const [total, data] = await Promise.all([
        input.count(),
        input.read(skip, pagination.limit)
    ]);

    return {
        data,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: calculateTotalPages(total, pagination.limit)
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

/** Both collections are strict:false open row shapes, so one model type serves the transfer commands. */
const modelFor = (documentType: TeamClusterDaemonPluginMongoDocumentType): Model<PluginListingRowDocument> =>
    (documentType === 'listing' ? PluginListingRowModel : PluginSubListingRowModel);

const normalizeAnalysisIds = (analysisIds: string[]): string[] =>
    [...new Set(analysisIds.filter((analysisId) => analysisId.length > 0))];

/** Export, import and purge all address the same set of analyses. */
const byAnalysisIds = (analysisIds: string[]): { analysis: { $in: string[] } } => ({
    analysis: {
        $in: analysisIds
    }
});

export class MongoPluginListingRepository {
    async listPluginListings(filter: PluginListingFilter): Promise<ListingPaginatedResult> {
        const query: PluginListingQuery = {
            ...(filter.pluginId ? { plugin: filter.pluginId } : {}),
            ...(filter.trajectoryId ? { trajectory: filter.trajectoryId } : {}),
            ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
            ...(filter.exposureId ? { exposureId: filter.exposureId } : {}),
            ...(filter.exposureName ? { exposureName: filter.exposureName } : {})
        };

        const page = await readPagedDocuments<PluginListingPageDocument>({
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
        const columns = new Set<string>();
        let subListingNames: string[] = [];

        for (const document of page.data) {
            const rowKeys = document.row
                ? Object.keys(document.row)
                : Object.keys(document).filter((key) => !SYSTEM_KEYS.has(key));

            for (const key of rowKeys) {
                columns.add(key);
            }

            if (subListingNames.length === 0 && document.subListingNames?.length) {
                subListingNames = document.subListingNames;
            }
        }

        return {
            ...page,
            columns: Array.from(columns),
            subListingNames
        };
    }

    listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>> {
        const query: PluginSubListingQuery = {
            ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
            ...(filter.exposureId ? { exposureId: filter.exposureId } : {}),
            ...(filter.timestep !== undefined ? { timestep: filter.timestep } : {}),
            ...(filter.subListingName ? { subListingName: filter.subListingName } : {})
        };

        return readPagedDocuments<PluginSubListingRowDocument>({
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

        const bulkOperations = inputs.flatMap((input) => input.rows.map((row, index) => {
            const replacement = {
                _id: `${input.analysis}:${input.exposureId}:${input.timestep}:${input.subListingName}:${index}`,
                analysis: input.analysis,
                exposureId: input.exposureId,
                timestep: input.timestep,
                subListingName: input.subListingName,
                row
            };

            return {
                replaceOne: {
                    filter: {
                        _id: replacement._id
                    },
                    replacement,
                    upsert: true
                }
            };
        }));

        if (bulkOperations.length > 0) {
            await PluginSubListingRowModel.bulkWrite(bulkOperations);
        }
    }

    async exportMongoRows(input: TeamClusterDaemonPluginMongoExportPayload): Promise<PluginMongoRowsExportResult> {
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

        const query = byAnalysisIds(analysisIds);
        const model = modelFor(input.documentType);
        const [total, rows] = await Promise.all([
            model.countDocuments(query),
            model.find(query)
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

    async importMongoRows(input: TeamClusterDaemonPluginMongoImportPayload): Promise<number> {
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

        await modelFor(input.documentType).bulkWrite(bulkOperations);
        return rows.length;
    }

    async purgeMongoRows(input: TeamClusterDaemonPluginMongoPurgePayload): Promise<number> {
        const analysisIds = normalizeAnalysisIds(input.analysisIds);
        if (analysisIds.length === 0) {
            return 0;
        }

        const result = await modelFor(input.documentType).deleteMany(byAnalysisIds(analysisIds));
        return result.deletedCount ?? 0;
    }
};

export const getPluginListingRepository = singleton((): MongoPluginListingRepository => new MongoPluginListingRepository());

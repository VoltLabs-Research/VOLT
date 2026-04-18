import { PluginListingRowModel } from '@/modules/plugin/domain/models/plugin-listing-row-model';
import { PluginSubListingRowModel } from '@/modules/plugin/domain/models/plugin-sub-listing-row-model';
import { calculatePaginationOffset, calculateTotalPages, normalizePagination } from '@/support/contracts/pagination';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { decodeMultiStream } from '@/support/serialization/selective-msgpack';
import mergeChunkedValue from '@/core/reverse-channel/application/merge-chunked-value';
import { createZstdDecompressionStream } from '@/support/serialization/storage-codec';
import { isRecord } from '@/support/type-guards/is-record';
import type { PluginListingRowDocument } from '@/modules/plugin/domain/models/plugin-listing-row-model';
import type { PluginSubListingRowDocument } from '@/modules/plugin/domain/models/plugin-sub-listing-row-model';
import type { PaginatedResult } from '@/support/contracts/pagination';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
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
    PluginSubListingFilter
} from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';

type MongoRow = PluginMongoRow;

interface ImportableMongoRow extends MongoRow {
    _id: string;
    payloadOwnerClusterId?: string;
}

interface PluginListingPageDocument extends PluginListingRowDocument {
    row?: MongoRow;
    subListingNames?: string[];
}

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

interface PluginSubListingSource {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    ownerClusterId: string;
    objectKey: string;
};

interface PluginSubListingSourceDocument {
    payloadOwnerClusterId: string;
    payloadObjectKey: string;
}

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

interface SubListingPageResult {
    rows: MongoRow[];
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
    'payloadObjectKey',
    'subListingNames',
    '__v',
    'row'
]);

const appendRowsWithinPage = (
    pageRows: MongoRow[],
    rows: MongoRow[],
    total: number,
    offset: number,
    limit: number
): number => {
    let nextTotal = total;

    for (const row of rows) {
        if (nextTotal >= offset && pageRows.length < limit) {
            pageRows.push(row);
        }

        nextTotal += 1;
    }

    return nextTotal;
};

const normalizeAnalysisIds = (analysisIds: string[]): string[] => {
    return [...new Set(analysisIds.filter((analysisId) => analysisId.length > 0))];
};

export class MongoPluginListingRepository implements PluginListingRepository {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly localOwnerClusterId: string
    ) {}

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
        const source = await this.resolvePluginSubListingSource(filter);
        if (source) {
            try {
                const pagination = normalizePagination(filter.page, filter.limit);
                const offset = calculatePaginationOffset(pagination.page, pagination.limit);
                const pagedRows = await this.readPagedSubListingRowsFromObject(
                    source.ownerClusterId,
                    source.objectKey,
                    source.subListingName,
                    offset,
                    pagination.limit
                );

                return {
                    data: pagedRows.rows.map((row, index) => ({
                        _id: `${source.analysisId}:${source.exposureId}:${source.timestep}:${source.subListingName}:${offset + index}`,
                        analysis: source.analysisId,
                        exposureId: source.exposureId,
                        timestep: source.timestep,
                        subListingName: source.subListingName,
                        row
                    })),
                    page: pagination.page,
                    limit: pagination.limit,
                    total: pagedRows.total,
                    totalPages: calculateTotalPages(pagedRows.total, pagination.limit)
                };
            } catch {
            }
        }

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
                    .lean<MongoRow[]>()
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
                .lean<MongoRow[]>()
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
            .map((row) => ({
                ...row,
                ...(row.payloadOwnerClusterId
                    ? { payloadOwnerClusterId: this.localOwnerClusterId }
                    : {})
            }));
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

    private async resolvePluginSubListingSource(
        filter: PluginSubListingFilter
    ): Promise<PluginSubListingSource | null> {
        if (!filter.analysisId || !filter.exposureId) {
            return null;
        }

        if (filter.timestep === undefined || !filter.subListingName) {
            return null;
        }

        const listingDocument = await PluginListingRowModel.findOne<PluginSubListingSourceDocument | null>(
            {
                analysis: filter.analysisId,
                exposureId: filter.exposureId,
                timestep: filter.timestep
            },
            {
                payloadObjectKey: 1,
                payloadOwnerClusterId: 1,
                _id: 0
            }
        ).lean();

        if (!listingDocument) {
            return null;
        }

        return {
            analysisId: filter.analysisId,
            exposureId: filter.exposureId,
            timestep: filter.timestep,
            subListingName: filter.subListingName,
            ownerClusterId: listingDocument.payloadOwnerClusterId,
            objectKey: listingDocument.payloadObjectKey
        };
    }

    private async readPagedSubListingRowsFromObject(
        ownerClusterId: string,
        objectKey: string,
        subListingName: string,
        offset: number,
        limit: number
    ): Promise<SubListingPageResult> {
        const response = await this.objectStore.getStream(ownerClusterId, ObjectBucketName.Plugins, objectKey, {
            skipMetadata: true
        });
        const stream = createZstdDecompressionStream(response.stream).stream;
        const pageRows: MongoRow[] = [];
        let totalRows = 0;
        let mergedObjectRow: MongoRow | null = null;
        let hasMergedObjectRow = false;

        for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
            if (!isRecord(message) || !isRecord(message.sub_listings)) {
                continue;
            }

            const subListingChunk = message.sub_listings[subListingName];
            if (Array.isArray(subListingChunk)) {
                totalRows = appendRowsWithinPage(
                    pageRows,
                    subListingChunk.filter(isRecord),
                    totalRows,
                    offset,
                    limit
                );
                continue;
            }

            if (!isRecord(subListingChunk)) {
                continue;
            }

            const mergedValue = mergeChunkedValue(mergedObjectRow, subListingChunk);
            mergedObjectRow = isRecord(mergedValue)
                ? mergedValue
                : mergedObjectRow;
            hasMergedObjectRow = true;
        }

        if (hasMergedObjectRow && mergedObjectRow) {
            totalRows = appendRowsWithinPage(
                pageRows,
                [mergedObjectRow],
                totalRows,
                offset,
                limit
            );
        }

        return {
            rows: pageRows,
            total: totalRows
        };
    }
};

export const createPluginListingRepository = (
    objectStore: ClusterObjectStore,
    localOwnerClusterId: string
): PluginListingRepository => {
    return new MongoPluginListingRepository(objectStore, localOwnerClusterId);
};

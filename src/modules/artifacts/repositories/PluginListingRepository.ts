import { PluginListingRowModel } from '../models/PluginListingRowModel';
import { PluginSubListingRowModel } from '../models/PluginSubListingRowModel';
import { calculatePaginationOffset, calculateTotalPages, normalizePagination } from '@/shared/contracts';
import { ObjectBucketName } from '@/shared/contracts';
import { decodeMultiStream, mergeSelectiveChunk } from '@/shared/utilities/selective-msgpack';
import { isRecord, readString, toRecord } from '@/shared/utils';
import type { PluginListingRowDocument } from '../models/PluginListingRowModel';
import type { PluginSubListingRowDocument } from '../models/PluginSubListingRowModel';
import type { PaginatedResult } from '@/shared/contracts';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

export interface PluginListingFilter {
    pluginId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureId?: string;
    exposureName?: string;
    page: number;
    limit: number;
};

export interface PluginSubListingFilter {
    analysisId?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
    page: number;
    limit: number;
};

export type PluginMongoDocumentType = 'listing' | 'sub-listing';

export interface BulkUpsertOperation {
    filter: Record<string, unknown>;
    update: Record<string, unknown>;
};

export interface ListingPaginatedResult extends PaginatedResult<PluginListingRowDocument> {
    columns: string[];
    subListingNames: string[];
};

export interface PluginListingRepository {
    listPluginListings(filter: PluginListingFilter): Promise<ListingPaginatedResult>;
    listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>>;
    bulkUpsertListingRows(operations: BulkUpsertOperation[]): Promise<void>;
    insertSubListingRows(documents: Array<Record<string, unknown>>): Promise<void>;
    deleteSubListingRows(filter: Record<string, unknown>): Promise<void>;
    exportMongoRows(input: {
        analysisIds: string[];
        documentType: PluginMongoDocumentType;
        skip?: number;
        limit?: number;
    }): Promise<{
        rows: Record<string, unknown>[];
        total: number;
        hasMore: boolean;
        nextSkip: number;
    }>;
    importMongoRows(input: {
        analysisIds: string[];
        documentType: PluginMongoDocumentType;
        rows: Record<string, unknown>[];
    }): Promise<number>;
    purgeMongoRows(input: {
        analysisIds: string[];
        documentType: PluginMongoDocumentType;
    }): Promise<number>;
};

interface PluginListingQuery {
    plugin?: string;
    trajectory?: string;
    analysis?: string;
    exposureId?: string;
    exposureName?: string;
};

interface PluginSubListingQuery {
    analysis?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
};

interface PluginSubListingSource {
    ownerClusterId: string;
    objectKey: string;
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
    'trajectoryName',
    'timestep',
    'payloadObjectKey',
    'subListingNames',
    '__v',
    'row'
]);

const toPluginListingRowDocument = (value: unknown): PluginListingRowDocument => {
    const record = toRecord(value);

    return {
        _id: readString(record._id),
        ...record
    };
};

const toPluginSubListingRowDocument = (value: unknown): PluginSubListingRowDocument => {
    const record = toRecord(value);

    return {
        _id: readString(record._id),
        ...record
    };
};

const buildPluginListingQuery = (filter: PluginListingFilter): PluginListingQuery => {
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

    return query;
};

const buildPluginSubListingQuery = (filter: PluginSubListingFilter): PluginSubListingQuery => {
    const query: PluginSubListingQuery = {};

    if (filter.analysisId) {
        query.analysis = filter.analysisId;
    }

    if (filter.exposureId) {
        query.exposureId = filter.exposureId;
    }

    if (typeof filter.timestep === 'number') {
        query.timestep = filter.timestep;
    }

    if (filter.subListingName) {
        query.subListingName = filter.subListingName;
    }

    return query;
};

const collectColumns = (documents: PluginListingRowDocument[]): string[] => {
    const columns = new Set<string>();

    for (const document of documents) {
        const rowData = document.row;

        if (rowData && typeof rowData === 'object' && !Array.isArray(rowData)) {
            const rowRecord = rowData as Record<string, unknown>;

            for (const key of Object.keys(rowRecord)) {
                columns.add(key);
            }

            continue;
        }

        for (const key of Object.keys(document)) {
            if (!SYSTEM_KEYS.has(key)) {
                columns.add(key);
            }
        }
    }

    return Array.from(columns);
};

const readSubListingNames = (documents: PluginListingRowDocument[]): string[] => {
    for (const document of documents) {
        if (!Array.isArray(document.subListingNames) || document.subListingNames.length === 0) {
            continue;
        }

        return document.subListingNames.map(String);
    }

    return [];
};

const buildPluginPayloadObjectKey = (
    trajectoryId: string,
    analysisId: string,
    exposureId: string,
    timestep: number
): string => {
    return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
};

const normalizeSubListingRows = (value: unknown): Record<string, unknown>[] => {
    if (Array.isArray(value)) {
        return value.filter(isRecord);
    }

    if (isRecord(value)) {
        return [value];
    }

    return [];
};

const normalizeMongoExportRows = (rows: Array<Record<string, unknown>>): Record<string, unknown>[] => {
    return rows.map((row) => ({ ...row }));
};

const normalizeMongoImportRows = (
    rows: Record<string, unknown>[],
    localOwnerClusterId: string
): Record<string, unknown>[] => {
    return rows
        .filter((row) => typeof row._id === 'string' && row._id.length > 0)
        .map((row) => ({
            ...row,
            ...(typeof row.payloadOwnerClusterId === 'string' && row.payloadOwnerClusterId.length > 0
                ? { payloadOwnerClusterId: localOwnerClusterId }
                : {})
        }));
};

const normalizeAnalysisIds = (analysisIds: string[]): string[] => {
    return [...new Set(analysisIds.filter((analysisId) => typeof analysisId === 'string' && analysisId.length > 0))];
};

export class MongoPluginListingRepository implements PluginListingRepository {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly localOwnerClusterId: string
    ) {}

    async listPluginListings(filter: PluginListingFilter): Promise<ListingPaginatedResult> {
        const query = buildPluginListingQuery(filter);
        const pageResult = await readPagedDocuments({
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
                .lean()
        });
        const documents = pageResult.documents.map(toPluginListingRowDocument);
        const columns = collectColumns(documents);
        const subListingNames = readSubListingNames(documents);

        return {
            data: documents,
            page: pageResult.page,
            limit: pageResult.limit,
            total: pageResult.total,
            totalPages: calculateTotalPages(pageResult.total, pageResult.limit),
            columns,
            subListingNames
        };
    }

    async listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>> {
        const payloadResult = await this.listPluginSubListingsFromPayload(filter);
        if (payloadResult) {
            return payloadResult;
        }

        const query = buildPluginSubListingQuery(filter);
        const pageResult = await readPagedDocuments({
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
                .lean()
        });

        return {
            data: pageResult.documents.map(toPluginSubListingRowDocument),
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

    async insertSubListingRows(documents: Array<Record<string, unknown>>): Promise<void> {
        if (documents.length === 0) {
            return;
        }

        await PluginSubListingRowModel.insertMany(documents);
    }

    async deleteSubListingRows(filter: Record<string, unknown>): Promise<void> {
        await PluginSubListingRowModel.deleteMany(filter);
    }

    async exportMongoRows(input: {
        analysisIds: string[];
        documentType: PluginMongoDocumentType;
        skip?: number;
        limit?: number;
    }): Promise<{
        rows: Record<string, unknown>[];
        total: number;
        hasMore: boolean;
        nextSkip: number;
    }> {
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
                    .lean<Record<string, unknown>[]>()
            ]);

            return {
                rows: normalizeMongoExportRows(rows),
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
                .lean<Record<string, unknown>[]>()
        ]);

        return {
            rows: normalizeMongoExportRows(rows),
            total,
            hasMore: skip + rows.length < total,
            nextSkip: skip + rows.length
        };
    }

    async importMongoRows(input: {
        analysisIds: string[];
        documentType: PluginMongoDocumentType;
        rows: Record<string, unknown>[];
    }): Promise<number> {
        const rows = normalizeMongoImportRows(input.rows, this.localOwnerClusterId);
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

    async purgeMongoRows(input: {
        analysisIds: string[];
        documentType: PluginMongoDocumentType;
    }): Promise<number> {
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

    private async listPluginSubListingsFromPayload(
        filter: PluginSubListingFilter
    ): Promise<PaginatedResult<PluginSubListingRowDocument> | null> {
        const source = await this.resolvePluginSubListingSource(filter);
        if (!source) {
            return null;
        }

        try {
            const rows = await this.readSubListingRowsFromObject(
                source.ownerClusterId,
                source.objectKey,
                filter.subListingName || ''
            );
            const pagination = normalizePagination(filter.page, filter.limit);
            const offset = calculatePaginationOffset(pagination.page, pagination.limit);
            const pageRows = rows.slice(offset, offset + pagination.limit);

            return {
                data: pageRows.map((row, index) => ({
                    _id: `${filter.analysisId || 'analysis'}:${filter.exposureId || 'exposure'}:${String(filter.timestep ?? 'timestep')}:${filter.subListingName || 'sub-listing'}:${offset + index}`,
                    analysis: filter.analysisId,
                    exposureId: filter.exposureId,
                    timestep: filter.timestep,
                    subListingName: filter.subListingName,
                    row
                })),
                page: pagination.page,
                limit: pagination.limit,
                total: rows.length,
                totalPages: calculateTotalPages(rows.length, pagination.limit)
            };
        } catch {
            return null;
        }
    }

    private async resolvePluginSubListingSource(
        filter: PluginSubListingFilter
    ): Promise<PluginSubListingSource | null> {
        if (
            !filter.analysisId
            || !filter.exposureId
            || typeof filter.timestep !== 'number'
            || !filter.subListingName
        ) {
            return null;
        }

        const listingDocument = await PluginListingRowModel.findOne(
            {
                analysis: filter.analysisId,
                exposureId: filter.exposureId,
                timestep: filter.timestep
            },
            {
                payloadObjectKey: 1,
                payloadOwnerClusterId: 1,
                trajectory: 1
            }
        ).lean<Record<string, unknown> | null>();

        const payloadObjectKey = typeof listingDocument?.payloadObjectKey === 'string'
            ? listingDocument.payloadObjectKey
            : undefined;
        const payloadOwnerClusterId = typeof listingDocument?.payloadOwnerClusterId === 'string'
            ? listingDocument.payloadOwnerClusterId
            : undefined;
        if (payloadObjectKey && payloadOwnerClusterId) {
            return {
                ownerClusterId: payloadOwnerClusterId,
                objectKey: payloadObjectKey
            };
        }

        return null;
    }

    private async readSubListingRowsFromObject(
        ownerClusterId: string,
        objectKey: string,
        subListingName: string
    ): Promise<Record<string, unknown>[]> {
        if (!ownerClusterId) {
            return [];
        }

        const response = await this.objectStore.getStream(ownerClusterId, ObjectBucketName.Plugins, objectKey, {
            skipMetadata: true
        });
        let decoded: Record<string, unknown> | null = null;

        for await (const message of decodeMultiStream(response.stream as AsyncIterable<Uint8Array>)) {
            decoded = mergeSelectiveChunk(decoded, message, (key) => key === 'sub_listings');
        }

        if (!decoded || !isRecord(decoded.sub_listings)) {
            return [];
        }

        return normalizeSubListingRows(decoded.sub_listings[subListingName]);
    }
};

export const createPluginListingRepository = (
    objectStore: ClusterObjectStore,
    localOwnerClusterId: string
): PluginListingRepository => {
    return new MongoPluginListingRepository(objectStore, localOwnerClusterId);
};

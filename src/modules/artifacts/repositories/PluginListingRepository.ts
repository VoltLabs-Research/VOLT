import { PluginListingRowModel } from '../models/PluginListingRowModel';
import { PluginSubListingRowModel } from '../models/PluginSubListingRowModel';
import { calculatePaginationOffset, calculateTotalPages, normalizePagination } from '@/shared/contracts';
import { ObjectBucketName } from '@/shared/contracts';
import { decodeMultiStream, mergeSelectiveChunk } from '@/shared/utilities/selective-msgpack';
import { isRecord, readString, toRecord } from '@/shared/utils';
import type { MinioService } from '@/modules/platform/services';
import type { PluginListingRowDocument } from '../models/PluginListingRowModel';
import type { PluginSubListingRowDocument } from '../models/PluginSubListingRowModel';
import type { PaginatedResult } from '@/shared/contracts';

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

export class MongoPluginListingRepository implements PluginListingRepository {
    constructor(
        private readonly minioService: MinioService
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

    private async listPluginSubListingsFromPayload(
        filter: PluginSubListingFilter
    ): Promise<PaginatedResult<PluginSubListingRowDocument> | null> {
        const source = await this.resolvePluginSubListingSource(filter);
        if (!source) {
            return null;
        }

        try {
            const rows = await this.readSubListingRowsFromObject(source.objectKey, filter.subListingName || '');
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
                trajectory: 1
            }
        ).lean<Record<string, unknown> | null>();

        const payloadObjectKey = typeof listingDocument?.payloadObjectKey === 'string'
            ? listingDocument.payloadObjectKey
            : undefined;
        if (payloadObjectKey) {
            return { objectKey: payloadObjectKey };
        }

        const trajectoryId = typeof listingDocument?.trajectory === 'string'
            ? listingDocument.trajectory
            : undefined;
        if (!trajectoryId) {
            return null;
        }

        return {
            objectKey: buildPluginPayloadObjectKey(
                trajectoryId,
                filter.analysisId,
                filter.exposureId,
                filter.timestep
            )
        };
    }

    private async readSubListingRowsFromObject(
        objectKey: string,
        subListingName: string
    ): Promise<Record<string, unknown>[]> {
        const stream = await this.minioService.getObjectStream(ObjectBucketName.Plugins, objectKey);
        let decoded: Record<string, unknown> | null = null;

        for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
            decoded = mergeSelectiveChunk(decoded, message, (key) => key === 'sub_listings');
        }

        if (!decoded || !isRecord(decoded.sub_listings)) {
            return [];
        }

        return normalizeSubListingRows(decoded.sub_listings[subListingName]);
    }
};

export const createPluginListingRepository = (minioService: MinioService): PluginListingRepository => {
    return new MongoPluginListingRepository(minioService);
};

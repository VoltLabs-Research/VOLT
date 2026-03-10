import { PluginListingRowModel } from '../models/PluginListingRowModel';
import { PluginSubListingRowModel } from '../models/PluginSubListingRowModel';
import { calculatePaginationOffset, calculateTotalPages, normalizePagination } from '@/shared/contracts';
import { readString, toRecord } from '@/shared/utils';
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

export class MongoPluginListingRepository implements PluginListingRepository {
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
};

export const createPluginListingRepository = (): PluginListingRepository => {
    return new MongoPluginListingRepository();
};

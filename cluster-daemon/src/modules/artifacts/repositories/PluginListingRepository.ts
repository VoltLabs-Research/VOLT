import { PluginListingRowModel, type PluginListingRowDocument } from '../models/PluginListingRowModel';
import { PluginSubListingRowModel, type PluginSubListingRowDocument } from '../models/PluginSubListingRowModel';

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

export interface PaginatedResult<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export interface ListingPaginatedResult extends PaginatedResult<PluginListingRowDocument> {
    columns: string[];
    subListingNames: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readString = (value: unknown): string => {
    return typeof value === 'string' ? value : '';
};

const toPluginListingRowDocument = (value: unknown): PluginListingRowDocument => {
    const record = isRecord(value) ? value : {};

    return {
        _id: readString(record._id),
        ...record
    };
};

const toPluginSubListingRowDocument = (value: unknown): PluginSubListingRowDocument => {
    const record = isRecord(value) ? value : {};

    return {
        _id: readString(record._id),
        ...record
    };
};

const SYSTEM_KEYS = new Set([
    '_id', 'plugin', 'team', 'trajectory', 'analysis',
    'exposureId', 'exposureName', 'trajectoryName',
    'timestep', 'subListingNames', '__v', 'row'
]);

export const listPluginListings = async (filter: PluginListingFilter): Promise<ListingPaginatedResult> => {
    const query = {
        ...(filter.pluginId ? { plugin: filter.pluginId } : {}),
        ...(filter.trajectoryId ? { trajectory: filter.trajectoryId } : {}),
        ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
        ...(filter.exposureId ? { exposureId: filter.exposureId } : {}),
        ...(filter.exposureName ? { exposureName: filter.exposureName } : {})
    };
    const skip = (filter.page - 1) * filter.limit;
    const total = await PluginListingRowModel.countDocuments(query);
    const data = await PluginListingRowModel.find(query)
        .sort({ timestep: -1, _id: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean();

    const docs = data.map(toPluginListingRowDocument);

    const columnSet = new Set<string>();
    for (const doc of docs) {
        for (const key of Object.keys(doc)) {
            if (!SYSTEM_KEYS.has(key)) {
                columnSet.add(key);
            }
        }
    }
    const columns = Array.from(columnSet);

    let subListingNames: string[] = [];
    for (const doc of docs) {
        const names = (doc as Record<string, unknown>).subListingNames;
        if (Array.isArray(names) && names.length > 0) {
            subListingNames = names.map(String);
            break;
        }
    }

    return {
        data: docs,
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / filter.limit)),
        columns,
        subListingNames
    };
};

export const listPluginSubListings = async (filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>> => {
    const query = {
        ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
        ...(filter.exposureId ? { exposureId: filter.exposureId } : {}),
        ...(typeof filter.timestep === 'number' ? { timestep: filter.timestep } : {}),
        ...(filter.subListingName ? { subListingName: filter.subListingName } : {})
    };
    const skip = (filter.page - 1) * filter.limit;
    const total = await PluginSubListingRowModel.countDocuments(query);
    const data = await PluginSubListingRowModel.find(query)
        .sort({ timestep: -1, _id: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean();

    return {
        data: data.map(toPluginSubListingRowDocument),
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / filter.limit))
    };
};

export const bulkUpsertListingRows = async (operations: BulkUpsertOperation[]): Promise<void> => {
    if (operations.length === 0) {
        return;
    }

    const bulkOps = operations.map((operation) => ({
        updateOne: {
            filter: operation.filter,
            update: { $set: operation.update },
            upsert: true
        }
    }));

    await PluginListingRowModel.bulkWrite(bulkOps);
};

export const insertSubListingRows = async (documents: Array<Record<string, unknown>>): Promise<void> => {
    if (documents.length === 0) {
        return;
    }

    await PluginSubListingRowModel.insertMany(documents);
};

export const deleteSubListingRows = async (filter: Record<string, unknown>): Promise<void> => {
    await PluginSubListingRowModel.deleteMany(filter);
};

export type PluginListingRepository = {
    listPluginListings: typeof listPluginListings;
    listPluginSubListings: typeof listPluginSubListings;
    bulkUpsertListingRows: typeof bulkUpsertListingRows;
    insertSubListingRows: typeof insertSubListingRows;
    deleteSubListingRows: typeof deleteSubListingRows;
};

export const pluginListingRepository: PluginListingRepository = {
    listPluginListings,
    listPluginSubListings,
    bulkUpsertListingRows,
    insertSubListingRows,
    deleteSubListingRows
};

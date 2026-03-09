import mongoose, { Schema } from 'mongoose';
import { CreateNotebookRequest, UpdateNotebookRequest } from '../contracts/http';

interface PluginListingRowDocument {
    _id: string;
    plugin?: string;
    team?: string;
    trajectory?: string;
    analysis?: string;
    exposureId?: string;
    exposureName?: string;
    trajectoryName?: string;
    timestep?: number;
    [key: string]: unknown;
};

interface PluginSubListingRowDocument {
    _id: string;
    analysis?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
    [key: string]: unknown;
};

export interface ScriptingNotebookDocument {
    _id: string;
    team: string;
    title: string;
    notebookPath: string;
    trajectories: string[];
    createdBy: string;
    content: Record<string, unknown>;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

interface PluginListingFilter {
    pluginId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureId?: string;
    page: number;
    limit: number;
};

interface PluginSubListingFilter {
    analysisId?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
    page: number;
    limit: number;
};

interface PaginatedResult<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readString = (value: unknown): string => {
    return typeof value === 'string' ? value : '';
};

const readOptionalDate = (value: unknown): Date | undefined => {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return undefined;
};

const readStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
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

const toScriptingNotebookDocument = (value: unknown): ScriptingNotebookDocument => {
    const record = isRecord(value) ? value : {};
    const createdAt = readOptionalDate(record.createdAt) || new Date();
    const updatedAt = readOptionalDate(record.updatedAt) || createdAt;

    return {
        _id: readString(record._id),
        team: readString(record.team),
        title: readString(record.title),
        notebookPath: readString(record.notebookPath),
        trajectories: readStringArray(record.trajectories),
        createdBy: readString(record.createdBy),
        content: isRecord(record.content) ? record.content : {},
        lastOpenedAt: readOptionalDate(record.lastOpenedAt),
        createdAt,
        updatedAt
    };
};

const pluginListingRowSchema = new Schema({}, {
    collection: 'pluginlistingrows',
    strict: false
});

const pluginSubListingRowSchema = new Schema({}, {
    collection: 'pluginsublistingrows',
    strict: false
});

const scriptingNotebookSchema = new Schema<ScriptingNotebookDocument>({
    team: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    notebookPath: {
        type: String,
        required: true,
        trim: true
    },
    trajectories: [{
        type: String,
        required: true
    }],
    createdBy: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: Schema.Types.Mixed,
        required: true
    },
    lastOpenedAt: {
        type: Date
    }
}, {
    collection: 'scriptingnotebooks',
    timestamps: true,
    minimize: false
});

const PluginListingRowModel = mongoose.models.DaemonPluginListingRow
    || mongoose.model<PluginListingRowDocument>('DaemonPluginListingRow', pluginListingRowSchema);
const PluginSubListingRowModel = mongoose.models.DaemonPluginSubListingRow
    || mongoose.model<PluginSubListingRowDocument>('DaemonPluginSubListingRow', pluginSubListingRowSchema);
const ScriptingNotebookModel = mongoose.models.DaemonScriptingNotebook
    || mongoose.model<ScriptingNotebookDocument>('DaemonScriptingNotebook', scriptingNotebookSchema);

export class LocalMongoService {
    constructor(private readonly mongodbUri: string) {
    }

    async connect(): Promise<void> {
        if (mongoose.connection.readyState === 1) {
            return;
        }

        await mongoose.connect(this.mongodbUri);
    }

    async disconnect(): Promise<void> {
        if (mongoose.connection.readyState === 0) {
            return;
        }

        await mongoose.disconnect();
    }

    async listPluginListings(filter: PluginListingFilter): Promise<PaginatedResult<PluginListingRowDocument>> {
        const query = {
            ...(filter.pluginId ? { plugin: filter.pluginId } : {}),
            ...(filter.trajectoryId ? { trajectory: filter.trajectoryId } : {}),
            ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
            ...(filter.exposureId ? { exposureId: filter.exposureId } : {})
        };
        const skip = (filter.page - 1) * filter.limit;
        const total = await PluginListingRowModel.countDocuments(query);
        const data = await PluginListingRowModel.find(query)
            .sort({ timestep: -1, _id: -1 })
            .skip(skip)
            .limit(filter.limit)
            .lean();

        return {
            data: data.map(toPluginListingRowDocument),
            page: filter.page,
            limit: filter.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / filter.limit))
        };
    }

    async listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>> {
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
    }

    async listNotebooks(teamId?: string): Promise<ScriptingNotebookDocument[]> {
        const query = teamId ? { team: teamId } : {};
        const notebooks = await ScriptingNotebookModel.find(query)
            .sort({ updatedAt: -1, _id: -1 })
            .lean();

        return notebooks.map(toScriptingNotebookDocument);
    }

    async createNotebook(input: CreateNotebookRequest): Promise<ScriptingNotebookDocument> {
        const notebook = await ScriptingNotebookModel.create({
            team: input.teamId,
            title: input.title,
            notebookPath: input.notebookPath,
            trajectories: input.trajectories,
            createdBy: input.createdBy,
            content: input.content ?? {}
        });

        return toScriptingNotebookDocument(notebook.toObject());
    }

    async updateNotebook(notebookId: string, input: UpdateNotebookRequest): Promise<ScriptingNotebookDocument | null> {
        const notebook = await ScriptingNotebookModel.findByIdAndUpdate(
            notebookId,
            {
                ...(input.title ? { title: input.title } : {}),
                ...(input.content ? { content: input.content } : {}),
                ...(input.lastOpenedAt ? { lastOpenedAt: new Date(input.lastOpenedAt) } : {})
            },
            {
                new: true
            }
        ).lean();

        return notebook ? toScriptingNotebookDocument(notebook) : null;
    }

    async deleteNotebook(notebookId: string): Promise<boolean> {
        const result = await ScriptingNotebookModel.deleteOne({ _id: notebookId });
        return result.deletedCount > 0;
    }

    async getNotebookById(notebookId: string): Promise<ScriptingNotebookDocument | null> {
        const notebook = await ScriptingNotebookModel.findById(notebookId).lean();
        return notebook ? toScriptingNotebookDocument(notebook) : null;
    }
}

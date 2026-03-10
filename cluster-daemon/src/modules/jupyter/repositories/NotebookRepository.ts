import { ScriptingNotebookModel } from '../models/ScriptingNotebookModel';
import { isRecord, readDocumentId, readOptionalDate, readString, readStringArray, toRecord } from '@/shared/utils';
import type { ScriptingNotebookDocument } from '../models/ScriptingNotebookModel';
import type { CreateNotebookRequest, UpdateNotebookRequest } from '@/shared/contracts';

export interface NotebookRepository {
    listNotebooks(teamId?: string): Promise<ScriptingNotebookDocument[]>;
    createNotebook(input: CreateNotebookRequest): Promise<ScriptingNotebookDocument>;
    updateNotebook(notebookId: string, input: UpdateNotebookRequest): Promise<ScriptingNotebookDocument | null>;
    deleteNotebook(notebookId: string): Promise<boolean>;
    getNotebookById(notebookId: string): Promise<ScriptingNotebookDocument | null>;
};

interface NotebookListQuery {
    team?: string;
};

interface NotebookCreateDocument {
    _id?: string;
    team: string;
    title: string;
    notebookPath: string;
    trajectories: string[];
    createdBy: string;
    content: Record<string, unknown>;
};

interface NotebookUpdateDocument {
    title?: string;
    content?: Record<string, unknown>;
    lastOpenedAt?: Date;
};

const toScriptingNotebookDocument = (value: unknown): ScriptingNotebookDocument => {
    const record = toRecord(value);
    const createdAt = readOptionalDate(record.createdAt) || new Date();
    const updatedAt = readOptionalDate(record.updatedAt) || createdAt;

    return {
        _id: readDocumentId(record._id),
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

const buildNotebookListQuery = (teamId?: string): NotebookListQuery => {
    const query: NotebookListQuery = {};

    if (teamId) {
        query.team = teamId;
    }

    return query;
};

const buildNotebookCreateDocument = (input: CreateNotebookRequest): NotebookCreateDocument => {
    const document: NotebookCreateDocument = {
        team: input.teamId,
        title: input.title,
        notebookPath: input.notebookPath,
        trajectories: input.trajectories,
        createdBy: input.createdBy,
        content: input.content ?? {}
    };

    if (input._id) {
        document._id = input._id;
    }

    return document;
};

const buildNotebookUpdateDocument = (input: UpdateNotebookRequest): NotebookUpdateDocument => {
    const update: NotebookUpdateDocument = {};

    if (input.title) {
        update.title = input.title;
    }

    if (input.content) {
        update.content = input.content;
    }

    if (input.lastOpenedAt) {
        update.lastOpenedAt = new Date(input.lastOpenedAt);
    }

    return update;
};

export class MongoNotebookRepository implements NotebookRepository {
    async listNotebooks(teamId?: string): Promise<ScriptingNotebookDocument[]> {
        const query = buildNotebookListQuery(teamId);
        const notebooks = await ScriptingNotebookModel.find(query)
            .sort({
                updatedAt: -1,
                _id: -1
            })
            .lean();

        return notebooks.map(toScriptingNotebookDocument);
    }

    async createNotebook(input: CreateNotebookRequest): Promise<ScriptingNotebookDocument> {
        const document = buildNotebookCreateDocument(input);
        const notebook = await ScriptingNotebookModel.create(document);

        return toScriptingNotebookDocument(notebook.toObject());
    }

    async updateNotebook(notebookId: string, input: UpdateNotebookRequest): Promise<ScriptingNotebookDocument | null> {
        const update = buildNotebookUpdateDocument(input);
        const notebook = await ScriptingNotebookModel.findByIdAndUpdate(
            notebookId,
            update,
            {
                new: true
            }
        ).lean();

        if (!notebook) {
            return null;
        }

        return toScriptingNotebookDocument(notebook);
    }

    async deleteNotebook(notebookId: string): Promise<boolean> {
        const result = await ScriptingNotebookModel.deleteOne({
            _id: notebookId
        });

        return result.deletedCount > 0;
    }

    async getNotebookById(notebookId: string): Promise<ScriptingNotebookDocument | null> {
        const notebook = await ScriptingNotebookModel.findById(notebookId).lean();

        if (!notebook) {
            return null;
        }

        return toScriptingNotebookDocument(notebook);
    }
};

export const createNotebookRepository = (): NotebookRepository => {
    return new MongoNotebookRepository();
};

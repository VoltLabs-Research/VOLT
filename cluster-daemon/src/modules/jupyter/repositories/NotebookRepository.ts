import { ScriptingNotebookModel, type ScriptingNotebookDocument } from '../models/ScriptingNotebookModel';
import type { CreateNotebookRequest, UpdateNotebookRequest } from '../../../shared/contracts';

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

export const listNotebooks = async (teamId?: string): Promise<ScriptingNotebookDocument[]> => {
    const query = teamId ? { team: teamId } : {};
    const notebooks = await ScriptingNotebookModel.find(query)
        .sort({ updatedAt: -1, _id: -1 })
        .lean();

    return notebooks.map(toScriptingNotebookDocument);
};

export const createNotebook = async (input: CreateNotebookRequest): Promise<ScriptingNotebookDocument> => {
    const notebook = await ScriptingNotebookModel.create({
        ...(input._id ? { _id: input._id } : {}),
        team: input.teamId,
        title: input.title,
        notebookPath: input.notebookPath,
        trajectories: input.trajectories,
        createdBy: input.createdBy,
        content: input.content ?? {}
    });

    return toScriptingNotebookDocument(notebook.toObject());
};

export const updateNotebook = async (notebookId: string, input: UpdateNotebookRequest): Promise<ScriptingNotebookDocument | null> => {
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
};

export const deleteNotebook = async (notebookId: string): Promise<boolean> => {
    const result = await ScriptingNotebookModel.deleteOne({ _id: notebookId });
    return result.deletedCount > 0;
};

export const getNotebookById = async (notebookId: string): Promise<ScriptingNotebookDocument | null> => {
    const notebook = await ScriptingNotebookModel.findById(notebookId).lean();
    return notebook ? toScriptingNotebookDocument(notebook) : null;
};

export type NotebookRepository = {
    listNotebooks: typeof listNotebooks;
    createNotebook: typeof createNotebook;
    updateNotebook: typeof updateNotebook;
    deleteNotebook: typeof deleteNotebook;
    getNotebookById: typeof getNotebookById;
};

export const notebookRepository: NotebookRepository = {
    listNotebooks,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    getNotebookById
};

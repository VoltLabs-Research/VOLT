import { ScriptingNotebookScope } from '@/modules/scripting/api/entities/scripting-notebook-scope';
import type { ExportType } from '@/shared/domain/export/types';
import type {
    ScriptingNotebook,
    ScriptingNotebookTrajectory
} from '@/modules/scripting/api/entities/scripting-notebook';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

interface NotebookExportRow {
    id: string;
    title: string;
    notebookPath: string;
    scope: string;
    trajectoryIds: string;
    lastOpenedAt: string;
    createdAt: string;
    updatedAt: string;
};

const NOTEBOOK_EXPORT_COLUMNS: Array<keyof NotebookExportRow> = [
    'id',
    'title',
    'notebookPath',
    'scope',
    'trajectoryIds',
    'lastOpenedAt',
    'createdAt',
    'updatedAt'
];

const serializeNotebookDate = (value: Date | string | undefined): string => {
    if (!value) {
        return '';
    }

    const parsedDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return '';
    }

    return parsedDate.toISOString();
};

const escapeCsvValue = (value: string): string => {
    const normalizedValue = value.replace(/"/g, '""');
    return `"${normalizedValue}"`;
};

const getTrajectoryId = (trajectory: ScriptingNotebookTrajectory | string): string => {
    if (typeof trajectory === 'string') {
        return trajectory;
    }

    return trajectory._id;
};

const mapNotebookToExportRow = (notebook: ScriptingNotebook): NotebookExportRow => {
    const trajectoryIds = getTrajectoryIds(notebook);
    const scope = trajectoryIds.length
        ? ScriptingNotebookScope.Trajectory
        : ScriptingNotebookScope.General;

    return {
        id: notebook._id,
        title: notebook.title || 'Untitled Notebook',
        notebookPath: notebook.notebookPath,
        scope,
        trajectoryIds: trajectoryIds.join(', '),
        lastOpenedAt: serializeNotebookDate(notebook.lastOpenedAt),
        createdAt: serializeNotebookDate(notebook.createdAt),
        updatedAt: serializeNotebookDate(notebook.updatedAt)
    };
};

const createJsonExportBlob = (rows: NotebookExportRow[]): Blob => {
    return new Blob([JSON.stringify(rows, null, 2)], {
        type: 'application/json;charset=utf-8'
    });
};

const createCsvExportBlob = (rows: NotebookExportRow[]): Blob => {
    const header = NOTEBOOK_EXPORT_COLUMNS.join(',');
    const body = rows.map((row) => {
        return NOTEBOOK_EXPORT_COLUMNS
            .map((column) => escapeCsvValue(String(row[column] || '')))
            .join(',');
    }).join('\n');

    return new Blob([[header, body].filter(Boolean).join('\n')], {
        type: 'text/csv;charset=utf-8'
    });
};

export const createEmptyNotebooksResponse = (
    params: PaginationParams
): PaginatedResponse<ScriptingNotebook> => ({
    status: 'success',
    data: [],
    pagination: {
        page: Math.max(1, Number(params.page) || 1),
        limit: Math.max(1, Number(params.limit) || 20),
        total: 0,
        totalPages: 1,
        hasMore: false
    }
});

export const getPrimaryTrajectory = (notebook: ScriptingNotebook): ScriptingNotebookTrajectory | string | null => {
    return notebook.trajectory ?? null;
};

export const getTrajectoryIds = (notebook: ScriptingNotebook): string[] => {
    const primaryTrajectory = getPrimaryTrajectory(notebook);
    if (!primaryTrajectory) {
        return [];
    }

    return [getTrajectoryId(primaryTrajectory)].filter((id) => id.trim().length > 0);
};

export const getDeleteConfirmationMessage = (selectedItems: ScriptingNotebook[]): string => {
    if (selectedItems.length === 1) {
        return `Delete notebook "${selectedItems[0].title || 'Untitled Notebook'}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} notebooks? This action cannot be undone.`;
};

export const createScriptingNotebooksExport = (
    notebooks: ScriptingNotebook[],
    format: ExportType
): Blob => {
    const rows = notebooks.map(mapNotebookToExportRow);

    if (format === 'csv') {
        return createCsvExportBlob(rows);
    }

    return createJsonExportBlob(rows);
};

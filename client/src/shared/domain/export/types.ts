export type ExportType = 'json' | 'csv';

interface ExportRequestParams {
    format: ExportType;
    [key: string]: unknown;
}

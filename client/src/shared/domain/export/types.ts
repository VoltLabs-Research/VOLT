export type ExportType = 'json' | 'csv';

export interface ExportRequestParams {
    format: ExportType;
    [key: string]: unknown;
}

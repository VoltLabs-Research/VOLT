export interface IJupyterNotebookService {
    resolveNotebookTemplateContent(): Promise<Record<string, unknown>>;
}

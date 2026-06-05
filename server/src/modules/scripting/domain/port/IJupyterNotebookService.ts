import type { DefaultNotebookTemplateContext } from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';

export interface IJupyterNotebookService {
    resolveNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<Record<string, unknown>>;
}

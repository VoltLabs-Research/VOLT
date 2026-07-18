// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:trajectoryId`/`:notebookId` path params)
// is NOT here — the service augments those on its own input.

import type { ScriptingNotebookContainerResources } from './domain';

export interface CreateScriptingNotebookInput{
    title?: string;
    teamClusterId: string;
}

export interface UpdateScriptingNotebookInput{
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

export interface CreateScriptingJupyterSessionInput{
    notebookId?: string;
    trajectoryId?: string;
    teamClusterId?: string;
}

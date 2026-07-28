import { z } from 'zod';
import { ScriptingNotebookScope } from './domain';

export const notebookRefSchema = z.object({ notebookId: z.string() });

export const createScriptingNotebookSchema = z.object({
    teamClusterId: z.string(),
    title: z.string().optional()
});

export const listScriptingNotebooksSchema = z.object({
    trajectoryId: z.string().optional(),
    scope: z.nativeEnum(ScriptingNotebookScope).optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(500)
});

export const updateScriptingNotebookSchema = z.object({
    notebookId: z.string(),
    title: z.string().optional(),
    teamClusterId: z.string().optional(),
    containerResources: z.object({
        cpus: z.number(),
        memoryMB: z.number()
    }).optional()
});

export const startScriptingJupyterSessionSchema = z.object({
    notebookId: z.string().optional(),
    trajectoryId: z.string().optional(),
    teamClusterId: z.string().optional()
});

export type NotebookRefInput = z.infer<typeof notebookRefSchema>;
export type CreateScriptingNotebookInput = z.infer<typeof createScriptingNotebookSchema>;
export type ListScriptingNotebooksInput = z.infer<typeof listScriptingNotebooksSchema>;
export type UpdateScriptingNotebookInput = z.infer<typeof updateScriptingNotebookSchema>;
export type StartScriptingJupyterSessionInput = z.infer<typeof startScriptingJupyterSessionSchema>;

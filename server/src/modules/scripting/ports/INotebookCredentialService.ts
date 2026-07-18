import type ScriptingNotebook from '@modules/scripting/entities/ScriptingNotebook';

export interface INotebookCredentialService {
    resolveSecretKey(notebook: ScriptingNotebook, userId: string): Promise<string>;
    revokeSecretKey(notebook: ScriptingNotebook): Promise<void>;
}

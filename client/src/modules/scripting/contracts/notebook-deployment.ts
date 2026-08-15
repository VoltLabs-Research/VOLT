import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';

export interface ScriptingNotebookDeploymentSelection {
    teamClusterId: string;
}

export interface ScriptingNotebookDeploymentModalRequest {
    teamId: string;
    title: string;
    description: string;
    confirmLabel: string;
    notebook?: ScriptingNotebook | null;
    onSubmit: (selection: ScriptingNotebookDeploymentSelection) => Promise<void>;
}

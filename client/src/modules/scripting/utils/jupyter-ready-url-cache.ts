/**
 * Remembers the URL of an already-ready Jupyter container so remounting the workspace
 * shows the notebook immediately instead of re-running the provisioning flow.
 */
const readyUrlByNotebookId = new Map<string, string>();
const readyUrlByTrajectoryId = new Map<string, string>();

interface JupyterReadyUrlKey {
    trajectoryId: string;
    notebookId?: string;
};

export const rememberReadyJupyterUrl = ({ trajectoryId, notebookId }: JupyterReadyUrlKey, url: string): void => {
    if (notebookId) {
        readyUrlByNotebookId.set(notebookId, url);
    }

    readyUrlByTrajectoryId.set(trajectoryId, url);
};

export const readRememberedJupyterUrl = ({ trajectoryId, notebookId }: JupyterReadyUrlKey): string | null => {
    const notebookUrl = notebookId ? readyUrlByNotebookId.get(notebookId) : undefined;

    return notebookUrl ?? readyUrlByTrajectoryId.get(trajectoryId) ?? null;
};

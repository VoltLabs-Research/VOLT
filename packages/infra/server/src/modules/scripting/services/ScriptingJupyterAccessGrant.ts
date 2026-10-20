export interface ScriptingJupyterAccessGrant {
    token: string;
    teamId: string;
    runtimeNotebookId: string;
    maxAgeMs: number;
}

interface ScriptingJupyterAccessGrantCarrier {
    accessGrant: ScriptingJupyterAccessGrant;
}

export const attachScriptingJupyterAccessGrant = <T extends object>(
    value: T,
    accessGrant: ScriptingJupyterAccessGrant
): T & ScriptingJupyterAccessGrantCarrier => {
    Object.defineProperty(value, 'accessGrant', {
        configurable: false,
        enumerable: false,
        value: accessGrant,
        writable: false
    });

    return value as T & ScriptingJupyterAccessGrantCarrier;
};

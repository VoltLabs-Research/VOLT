export interface ScriptingJupyterAccessGrant {
    token: string;
    teamId: string;
    runtimeNotebookId: string;
    maxAgeMs: number;
}

export interface ScriptingJupyterAccessGrantCarrier {
    readonly accessGrant?: ScriptingJupyterAccessGrant;
}

export const attachScriptingJupyterAccessGrant = <T extends object>(
    value: T,
    accessGrant: ScriptingJupyterAccessGrant
): T & Required<ScriptingJupyterAccessGrantCarrier> => {
    Object.defineProperty(value, 'accessGrant', {
        configurable: false,
        enumerable: false,
        value: accessGrant,
        writable: false
    });

    return value as T & Required<ScriptingJupyterAccessGrantCarrier>;
};

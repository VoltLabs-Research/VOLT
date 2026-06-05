export interface CreateScriptingJupyterAccessTokenInput {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

export interface VerifiedScriptingJupyterAccessToken {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
}

export interface IScriptingJupyterAccessTokenService {
    create(input: CreateScriptingJupyterAccessTokenInput): string;
    getCookieMaxAgeMs(): number;
    verify(token: string): VerifiedScriptingJupyterAccessToken | null;
}

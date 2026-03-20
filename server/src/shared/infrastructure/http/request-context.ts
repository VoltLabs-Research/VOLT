import { AsyncLocalStorage } from 'node:async_hooks';

export enum HttpRequestAuthType {
    User = 'user',
    SecretKey = 'secret-key'
};

export enum HttpRequestTeamContextSource {
    SecretKey = 'secret-key',
    Repository = 'repository'
};

export interface HttpRequestAuthContext {
    authType: HttpRequestAuthType;
    subjectId: string;
    durationMs: number;
    cached: boolean;
};

export interface HttpRequestTeamContext {
    teamId: string;
    userId?: string;
    durationMs: number;
    cached: boolean;
    source: HttpRequestTeamContextSource;
    permissions: string[];
};

export interface HttpRequestContext {
    traceId: string;
    startedAt: number;
    method: string;
    path: string;
    auth?: HttpRequestAuthContext;
    team?: HttpRequestTeamContext;
};

const httpRequestContextStorage = new AsyncLocalStorage<HttpRequestContext>();

export const runWithHttpRequestContext = <T>(context: HttpRequestContext, callback: () => T): T => {
    return httpRequestContextStorage.run(context, callback);
};

export const getHttpRequestContext = (): HttpRequestContext | undefined => {
    return httpRequestContextStorage.getStore();
};

export const setHttpRequestContextAuth = (
    auth: HttpRequestAuthContext
): HttpRequestContext | undefined => {
    const context = getHttpRequestContext();

    if (!context) {
        return undefined;
    }

    context.auth = auth;

    return context;
};

export const setHttpRequestContextTeam = (
    team: HttpRequestTeamContext
): HttpRequestContext | undefined => {
    const context = getHttpRequestContext();

    if (!context) {
        return undefined;
    }

    context.team = team;

    return context;
};

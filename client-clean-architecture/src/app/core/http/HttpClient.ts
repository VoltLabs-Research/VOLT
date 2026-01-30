export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type HttpRequest = {
    method: HttpMethod;
    url: string;
    query?: Record<string, any>;
    body?: any;
    headers?: Record<string, string>;
    signal?: AbortSignal;
};

export interface HttpClient{
    request<T>(req: HttpRequest): Promise<T>;
};
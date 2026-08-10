export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type HttpQuery = Record<string, unknown>;
export type HttpResponseType = 'json' | 'blob' | 'text';

export interface HttpProgressEvent {
    loaded: number;
    total?: number;
};

export interface HttpHeaders {
    [key: string]: string;
};

export type HttpRequest = {
    method: HttpMethod;
    url: string;
    query?: HttpQuery;
    body?: unknown;
    headers?: HttpHeaders;
    signal?: AbortSignal;
    responseType?: HttpResponseType;
    onUploadProgress?: (event: HttpProgressEvent) => void;
};

export interface HttpClient {
    request<T>(req: HttpRequest): Promise<T>;
};

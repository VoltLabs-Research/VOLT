export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface Endpoint<Input = never, Output = void>{
    readonly method: HttpMethod;
    readonly path: string;
    /**
     * Never assigned. Exists so `Input` and `Output` reach the structural type;
     * without it every `Endpoint<A, B>` is assignable to every `Endpoint<C, D>`.
     */
    readonly __io?: (input: Input) => Output;
}

/**
 * Fills the `:param` placeholders of an endpoint path. Route objects are the
 * single source of truth for paths; every caller that needs a concrete URL
 * goes through this instead of writing the path again.
 *
 * Throws when a placeholder is left unfilled.
 */
export const buildPath = (endpoint: Endpoint<never, unknown> | Endpoint<unknown, unknown>, params: Record<string, string> = {}): string => {
    const path = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
        const value = params[name];
        if (value === undefined || value === '') {
            throw new Error(`buildPath: missing value for ":${name}" in "${endpoint.path}"`);
        }

        return encodeURIComponent(value);
    });

    return path;
};

export const get = <Output>(path: string): Endpoint<never, Output> => ({
    method: 'GET',
    path
});
export const post = <Input = never, Output = void>(path: string): Endpoint<Input, Output> => ({
    method: 'POST',
    path
});
export const patch = <Input = never, Output = void>(path: string): Endpoint<Input, Output> => ({
    method: 'PATCH',
    path
});
export const put = <Input = never, Output = void>(path: string): Endpoint<Input, Output> => ({
    method: 'PUT',
    path
});
export const del = <Output = void>(path: string): Endpoint<never, Output> => ({
    method: 'DELETE',
    path
});

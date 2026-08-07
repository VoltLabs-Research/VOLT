export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface Endpoint<Input = never, Output = void>{
    readonly method: HttpMethod;
    readonly path: string;
    /**
     * Never assigned. It exists so `Input` and `Output` reach the structural type.
     *
     * Without it TypeScript ignores both parameters and every `Endpoint<A, B>`
     * becomes assignable to every `Endpoint<C, D>` — measured: passing an
     * `Endpoint<A, string>` where an `Endpoint<B, number>` is expected compiles
     * clean without this line and fails with TS2345 with it. Deleting it would turn
     * the type arguments on every route declaration into decoration.
     */
    readonly __io?: (input: Input) => Output;
}

export type InputOf<E> = E extends Endpoint<infer I, unknown> ? I : never;
export type OutputOf<E> = E extends Endpoint<never, infer O> ? O : E extends Endpoint<infer _I, infer O> ? O : never;

/**
 * Fills the `:param` placeholders of an endpoint path.
 *
 * Every caller that needs a concrete URL should go through this instead of
 * writing the path again: a client that hardcodes `/api/teams/${id}/clusters`
 * silently breaks when the route moves, because nothing connects the two.
 *
 * Throws when a placeholder is left unfilled, so a missing parameter fails at the
 * call rather than producing a URL containing a literal `:teamId`.
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

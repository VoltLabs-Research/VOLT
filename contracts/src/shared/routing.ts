export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface Endpoint<Input = never, Output = void>{
    readonly method: HttpMethod;
    readonly path: string;
    
    readonly __io?: (input: Input) => Output;
}

export type InputOf<E> = E extends Endpoint<infer I, unknown> ? I : never;
export type OutputOf<E> = E extends Endpoint<never, infer O> ? O : E extends Endpoint<infer _I, infer O> ? O : never;

export const get = <Output>(path: string): Endpoint<never, Output> => ({ method: 'GET', path });
export const post = <Input = never, Output = void>(path: string): Endpoint<Input, Output> => ({ method: 'POST', path });
export const patch = <Input = never, Output = void>(path: string): Endpoint<Input, Output> => ({ method: 'PATCH', path });
export const put = <Input = never, Output = void>(path: string): Endpoint<Input, Output> => ({ method: 'PUT', path });
export const del = <Output = void>(path: string): Endpoint<never, Output> => ({ method: 'DELETE', path });


export interface ErrorTable{
    readonly domain: string;
    readonly causes: Readonly<Record<string, number>>;
}

export type ErrorCode<T extends ErrorTable> =
    `${T['domain']}::${Extract<keyof T['causes'], string>}`;

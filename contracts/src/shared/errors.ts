/**
 * Declarative per-domain error table. `domain` + each cause name compose the
 * wire error code (`Auth::CredentialsInvalid`), and the value is the HTTP status.
 * The server turns a table into thrown `ApplicationError`s (see server-side
 * `defineErrors`), and the client can switch on the derived `ErrorCode<T>` union.
 */
export interface ErrorTable{
    readonly domain: string;
    readonly causes: Readonly<Record<string, number>>;
}

/** 'Auth::CredentialsInvalid' | 'Auth::EmailTaken' | … — derived, never hand-written. */
export type ErrorCode<T extends ErrorTable> =
    `${T['domain']}::${Extract<keyof T['causes'], string>}`;

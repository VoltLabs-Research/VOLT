import type { TeamClusterDaemonSocketHeaders } from '../contracts/reverseChannel';

/**
 * Result returned by a `ReverseChannelHandler.handle()` call.
 * Maps directly to the response envelope sent back to the server.
 */
export interface CommandResult<T = unknown> {
    /** HTTP-style status code included in the response envelope. @default 200 */
    status?: number;
    /** JSON-serialisable response data. */
    data?: T;
    /** Raw binary response body (mutually exclusive with `data`). */
    body?: Buffer;
    /** Additional headers forwarded in the response envelope. */
    headers?: TeamClusterDaemonSocketHeaders;
    /** Streaming response. Mutually exclusive with `data` and `body`. */
    stream?: ReadableStream<Uint8Array>;
};

/**
 * Context provided to every `ReverseChannelHandler.handle()` call.
 */
export interface HandlerContext {
    /** The command name exactly as received from the server. */
    command: string;
    /** The `requestId` from the incoming command envelope. */
    requestId: string;
};

import type { TeamClusterDaemonSocketHeaders } from '../contracts/reverseChannel';

export interface CommandResult<T = unknown> {
    status?: number;
    data?: T;
    body?: Buffer;
    headers?: TeamClusterDaemonSocketHeaders;
    stream?: ReadableStream<Uint8Array>;
};

export interface HandlerContext {
    command: string;
    requestId: string;
};

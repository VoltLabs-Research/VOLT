interface ReverseChannelPayloadObject {
    [key: string]: ReverseChannelPayloadValue;
}

type ReverseChannelPayloadValue =
    | boolean
    | null
    | number
    | string
    | ReverseChannelPayloadValue[]
    | ReverseChannelPayloadObject;

export interface ReverseChannelCommandPayloadView {
    requestId?: string;
    [key: string]: ReverseChannelPayloadValue | undefined;
}

export type ReverseChannelCommandPayload = object;

export type ReverseChannelCommandExecutor = (
    payload: ReverseChannelCommandPayload | undefined
) => Promise<ReverseChannelCommandResult>;

export interface ReverseChannelCommandResult {
    status?: number;
    data?: object | null;
    body?: Buffer;
    headers?: Record<string, string>;
    stream?: ReadableStream<Uint8Array>;
}

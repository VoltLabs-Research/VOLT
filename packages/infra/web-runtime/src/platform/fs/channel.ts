// The synchronous channel between a backend worker and its file system service worker. The caller
// writes a request into shared memory, wakes the service and blocks in Atomics.wait until the service
// has written the reply; payloads larger than the data area cross in several rounds.
//
// Control words (Int32):
//   0 state      IDLE -> REQUEST (caller) -> RESPONSE (service) -> IDLE (caller)
//   1 length     bytes used in the data area by the current message
//   2 more       1 while a message continues in the next round
export const STATE_IDLE = 0;
export const STATE_REQUEST = 1;
export const STATE_RESPONSE = 2;

export const CONTROL_WORDS = 4;
export const DATA_BYTES = 8 * 1024 * 1024;

export interface FsChannelBuffers {
    control: SharedArrayBuffer;
    data: SharedArrayBuffer;
}

// What a worker is given to use its parent's file system: its channel, and a port to the service.
export interface FsAttachment {
    channel: FsChannelBuffers;
    service: MessagePort;
}

export const createChannelBuffers = (): FsChannelBuffers => ({
    control: new SharedArrayBuffer(CONTROL_WORDS * Int32Array.BYTES_PER_ELEMENT),
    data: new SharedArrayBuffer(DATA_BYTES)
});

// A message is a JSON header plus an optional binary body: [u32 header length][header][body].
export const encodeMessage = (header: unknown, body?: Uint8Array): Uint8Array => {
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const message = new Uint8Array(4 + headerBytes.byteLength + (body?.byteLength ?? 0));
    new DataView(message.buffer).setUint32(0, headerBytes.byteLength, true);
    message.set(headerBytes, 4);
    if(body){
        message.set(body, 4 + headerBytes.byteLength);
    }
    return message;
};

export const decodeMessage = <T>(message: Uint8Array): { header: T; body: Uint8Array } => {
    const headerLength = new DataView(message.buffer, message.byteOffset, message.byteLength).getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(message.subarray(4, 4 + headerLength))) as T;
    return { header, body: message.subarray(4 + headerLength) };
};

export interface FsRequest {
    op: string;
    args: unknown[];
}

export type FsReply =
    | { ok: true; value: unknown }
    | { ok: false; code: string; message: string; syscall: string; path?: string };

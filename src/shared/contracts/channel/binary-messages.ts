export interface BinaryTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
    sequence?: number;
    requiresAck?: boolean;
}

export interface BinaryTunnelDrainPayload {
    type: 'tunnel-drain';
    sessionId: string;
    sequence: number;
}

export interface BinaryStreamPayload {
    type: 'stream';
    requestId: string;
    streamId: string;
    chunk: Uint8Array;
}

export interface BinarySessionDataPayload {
    type: 'session-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
}

export interface BinarySessionInputPayload {
    type: 'session-input';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
}

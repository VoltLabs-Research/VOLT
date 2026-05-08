/**
 * Local redefinition of the reverse-channel message types whose payloads
 * changed from `chunkBase64: string` / `bodyBase64: string` to a native
 * `Uint8Array` binary envelope (see `binary-envelope.ts`).
 *
 * The upstream SDK (`@voltstack/daemon-cluster-client`) is a compiled
 * artifact and cannot be modified in place. Socket.IO's runtime does not
 * introspect TypeScript types, so we treat the SDK types as nominal carriers
 * and override the structural shape locally where the daemon constructs or
 * consumes the payloads.
 */

export interface BinaryTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
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

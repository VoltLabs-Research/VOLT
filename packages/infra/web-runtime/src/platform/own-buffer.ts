import { Buffer } from 'buffer';
import { ownBytes } from './bytes';

// Bytes as a Buffer of its own memory, as Node hands out what it reads: programs take its .buffer for
// the bytes (Emscripten's glue loads its .wasm that way), and what arrives here is often a view into
// a larger message or a reused window.
export const ownBuffer = (view: Uint8Array): Buffer => {
    const owned = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength ? view : ownBytes(view);
    return Buffer.from(owned.buffer, owned.byteOffset, owned.byteLength);
};

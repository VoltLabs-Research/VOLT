// A copy of a view's bytes in a buffer of its own, safe to transfer or keep while the sender reuses
// its memory. Not view.slice(): a Node Buffer's slice is a view of the same memory (its pool), and a
// view of shared memory (a SharedArrayBuffer, as WebAssembly threads use) slices into shared memory.
export const ownBytes = (view: ArrayBufferView): Uint8Array<ArrayBuffer> => {
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return copy;
};

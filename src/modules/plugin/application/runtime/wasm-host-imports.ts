import { logger } from '@/core/logger';

export interface WasmHostState {
    memoryRef: () => WebAssembly.Memory;
    logSink: (level: 'info' | 'warn' | 'error', message: string) => void;
    abortFlag: { aborted: boolean; reason: string | null };
    pluginId: string;
    startedAt: number;
}

export interface WasmGuestExports {
    memory: WebAssembly.Memory;
    alloc: (size: number) => number;
    dealloc: (ptr: number, size: number) => void;
    process: (
        positionsPtr: number,
        positionsLen: number,
        typesPtr: number,
        typesLen: number,
        propsPtr: number,
        propsLen: number,
        configPtr: number,
        configLen: number
    ) => number;
}

const HOST_STRING_PREVIEW_LIMIT = 1024;

const decodeGuestBytes = (memory: WebAssembly.Memory, ptr: number, len: number): Uint8Array => {
    if (ptr < 0 || len < 0) {
        throw new Error(`wasm host: invalid guest pointer ptr=${ptr} len=${len}`);
    }
    const available = memory.buffer.byteLength - ptr;
    if (available < len) {
        throw new Error(`wasm host: guest pointer out of bounds ptr=${ptr} len=${len} memory=${memory.buffer.byteLength}`);
    }
    return new Uint8Array(memory.buffer, ptr, len);
};

const decodeGuestString = (memory: WebAssembly.Memory, ptr: number, len: number): string => {
    const bytes = decodeGuestBytes(memory, ptr, len);
    const clamped = bytes.subarray(0, Math.min(bytes.byteLength, HOST_STRING_PREVIEW_LIMIT));
    return new TextDecoder('utf-8', { fatal: false }).decode(clamped);
};

export const buildWasmHostImports = (state: WasmHostState): WebAssembly.Imports => {
    const volt: WebAssembly.ModuleImports = {
        log: (ptr: number, len: number): void => {
            try {
                const message = decodeGuestString(state.memoryRef(), ptr, len);
                state.logSink('info', message);
            } catch (error: unknown) {
                logger.warn({ err: error, pluginId: state.pluginId }, '@wasm-host-imports: log decode failed');
            }
        },
        log_warn: (ptr: number, len: number): void => {
            try {
                const message = decodeGuestString(state.memoryRef(), ptr, len);
                state.logSink('warn', message);
            } catch (error: unknown) {
                logger.warn({ err: error, pluginId: state.pluginId }, '@wasm-host-imports: log_warn decode failed');
            }
        },
        abort: (ptr: number, len: number): void => {
            try {
                const message = len > 0 ? decodeGuestString(state.memoryRef(), ptr, len) : 'wasm guest abort()';
                state.abortFlag.aborted = true;
                state.abortFlag.reason = message;
                state.logSink('error', `guest abort: ${message}`);
                throw new WasmGuestAbort(message);
            } catch (error: unknown) {
                if (error instanceof WasmGuestAbort) throw error;
                state.abortFlag.aborted = true;
                state.abortFlag.reason = 'abort() with invalid pointers';
                throw new WasmGuestAbort(state.abortFlag.reason);
            }
        },
        now_ms: (): number => {
            return Math.max(0, Date.now() - state.startedAt);
        }
    };

    const wasiStub: WebAssembly.ModuleImports = {
        fd_write: (): number => 0,
        fd_close: (): number => 0,
        fd_seek: (): number => 0,
        proc_exit: (code: number): void => {
            state.abortFlag.aborted = true;
            state.abortFlag.reason = `proc_exit(${code})`;
            throw new WasmGuestAbort(state.abortFlag.reason);
        }
    };

    return {
        volt,
        env: volt,
        wasi_snapshot_preview1: wasiStub
    };
};

export class WasmGuestAbort extends Error {
    public constructor(public readonly reason: string) {
        super(`wasm guest aborted: ${reason}`);
        this.name = 'WasmGuestAbort';
    }
}

export const decodeGuestResult = (memory: WebAssembly.Memory, resultPtr: number): Uint8Array => {
    if (resultPtr <= 0) {
        throw new Error('wasm host: guest process() returned null/zero pointer');
    }
    const header = new DataView(memory.buffer, resultPtr, 4);
    const resultLen = header.getUint32(0, true);
    if (resultLen === 0) return new Uint8Array(0);
    const payloadPtr = resultPtr + 4;
    if (payloadPtr + resultLen > memory.buffer.byteLength) {
        throw new Error(`wasm host: guest result exceeds memory bounds ptr=${resultPtr} len=${resultLen}`);
    }
    // Why: copy out of guest memory because the guest may dealloc / grow
    // memory after we return. A subarray view would be invalidated.
    const copy = new Uint8Array(resultLen);
    copy.set(new Uint8Array(memory.buffer, payloadPtr, resultLen));
    return copy;
};

export interface WriteGuestBufferResult {
    ptr: number;
    len: number;
}

export const writeGuestBuffer = (
    exports: WasmGuestExports,
    bytes: ArrayBufferView | ArrayBuffer
): WriteGuestBufferResult => {
    const view = bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.byteLength === 0) return { ptr: 0, len: 0 };
    const ptr = exports.alloc(view.byteLength);
    if (ptr === 0) {
        throw new Error(`wasm host: guest alloc(${view.byteLength}) returned null`);
    }
    new Uint8Array(exports.memory.buffer, ptr, view.byteLength).set(view);
    return { ptr, len: view.byteLength };
};

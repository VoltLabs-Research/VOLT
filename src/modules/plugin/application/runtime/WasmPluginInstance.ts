import { pack, unpack } from 'msgpackr';
import { logger } from '@/core/logger';
import {
    WasmGuestAbort,
    buildWasmHostImports,
    decodeGuestResult,
    writeGuestBuffer,
    type WasmGuestExports,
    type WasmHostState
} from '@/modules/plugin/application/runtime/wasm-host-imports';

export interface WasmFrameChunk {
    atomCount: number;
    positions: Float32Array;
    types: Uint16Array;
    properties?: Record<string, Float32Array>;
    ids?: Uint32Array;
    timestep?: number;
}

export interface WasmProcessInput {
    frame: WasmFrameChunk;
    config?: unknown;
    pluginId: string;
    timeoutMs: number;
    logSink?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

export interface WasmProcessResult {
    durationMs: number;
    startupMs: number;
    value: unknown;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const packPropertiesForGuest = (properties: Record<string, Float32Array> | undefined): Uint8Array => {
    if (!properties || Object.keys(properties).length === 0) {
        return pack({});
    }
    const wire: Record<string, number[]> = {};
    for (const [key, array] of Object.entries(properties)) {
        wire[key] = Array.from(array);
    }
    return pack(wire);
};

const packConfigForGuest = (config: unknown): Uint8Array => {
    if (config === undefined || config === null) return pack({});
    return pack(config);
};

const unwrapInstanceExports = (instance: WebAssembly.Instance): WasmGuestExports => {
    const raw = instance.exports as Record<string, WebAssembly.ExportValue>;
    const memory = raw.memory;
    const alloc = raw.alloc;
    const dealloc = raw.dealloc;
    const process = raw.process;

    if (!(memory instanceof WebAssembly.Memory)) {
        throw new Error('wasm plugin: missing required export `memory: WebAssembly.Memory`');
    }
    if (typeof alloc !== 'function') {
        throw new Error('wasm plugin: missing required export `alloc(size: u32) -> u32`');
    }
    if (typeof dealloc !== 'function') {
        throw new Error('wasm plugin: missing required export `dealloc(ptr: u32, size: u32)`');
    }
    if (typeof process !== 'function') {
        throw new Error(
            'wasm plugin: missing required export `process(positionsPtr, positionsLen, '
            + 'typesPtr, typesLen, propsPtr, propsLen, configPtr, configLen) -> u32`'
        );
    }

    return {
        memory,
        alloc: alloc as WasmGuestExports['alloc'],
        dealloc: dealloc as WasmGuestExports['dealloc'],
        process: process as WasmGuestExports['process']
    };
};

export class WasmPluginInstance {
    private readonly compiledModule: WebAssembly.Module;
    private readonly logSink: (level: 'info' | 'warn' | 'error', message: string) => void;

    public constructor(compiledModule: WebAssembly.Module, logSink?: (level: 'info' | 'warn' | 'error', message: string) => void) {
        this.compiledModule = compiledModule;
        this.logSink = logSink ?? ((level, message) => {
            if (level === 'error') {
                logger.error({ scope: 'wasm-guest' }, message);
            } else if (level === 'warn') {
                logger.warn({ scope: 'wasm-guest' }, message);
            } else {
                logger.info({ scope: 'wasm-guest' }, message);
            }
        });
    }

    public async process(input: WasmProcessInput): Promise<WasmProcessResult> {
        const instantiateStart = Date.now();
        const timeoutMs = input.timeoutMs > 0 ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
        const abortFlag = { aborted: false, reason: null as string | null };
        let memoryHolder: WebAssembly.Memory | null = null;

        const hostState: WasmHostState = {
            memoryRef: () => {
                if (!memoryHolder) throw new Error('wasm host: memory accessed before instantiation');
                return memoryHolder;
            },
            logSink: input.logSink ?? this.logSink,
            abortFlag,
            pluginId: input.pluginId,
            startedAt: instantiateStart
        };

        const imports = buildWasmHostImports(hostState);
        const instance = await WebAssembly.instantiate(this.compiledModule, imports);
        const exports = unwrapInstanceExports(instance);
        memoryHolder = exports.memory;

        const startupMs = Date.now() - instantiateStart;

        const positionsBytes = new Uint8Array(
            input.frame.positions.buffer,
            input.frame.positions.byteOffset,
            input.frame.positions.byteLength
        );
        const typesBytes = new Uint8Array(
            input.frame.types.buffer,
            input.frame.types.byteOffset,
            input.frame.types.byteLength
        );
        const propsBytes = packPropertiesForGuest(input.frame.properties);
        const configBytes = packConfigForGuest(input.config);

        const positionsHandle = writeGuestBuffer(exports, positionsBytes);
        const typesHandle = writeGuestBuffer(exports, typesBytes);
        const propsHandle = writeGuestBuffer(exports, propsBytes);
        const configHandle = writeGuestBuffer(exports, configBytes);

        let watchdog: NodeJS.Timeout | null = null;
        const invocationStart = Date.now();

        try {
            const resultPtr = await this.invokeWithTimeout(
                () => exports.process(
                    positionsHandle.ptr,
                    positionsHandle.len,
                    typesHandle.ptr,
                    typesHandle.len,
                    propsHandle.ptr,
                    propsHandle.len,
                    configHandle.ptr,
                    configHandle.len
                ),
                timeoutMs,
                abortFlag,
                (timer) => { watchdog = timer; }
            );

            if (abortFlag.aborted) {
                throw new WasmGuestAbort(abortFlag.reason ?? 'guest aborted without reason');
            }

            const resultBytes = decodeGuestResult(exports.memory, resultPtr);
            const value = resultBytes.byteLength === 0
                ? null
                : unpack(Buffer.from(resultBytes));

            return {
                durationMs: Date.now() - invocationStart,
                startupMs,
                value
            };
        } finally {
            if (watchdog) clearTimeout(watchdog);
            this.safeDealloc(exports, positionsHandle.ptr, positionsHandle.len);
            this.safeDealloc(exports, typesHandle.ptr, typesHandle.len);
            this.safeDealloc(exports, propsHandle.ptr, propsHandle.len);
            this.safeDealloc(exports, configHandle.ptr, configHandle.len);
        }
    }

    private invokeWithTimeout(
        invoke: () => number,
        timeoutMs: number,
        abortFlag: { aborted: boolean; reason: string | null },
        setWatchdog: (timer: NodeJS.Timeout) => void
    ): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            // Why: WebAssembly.Instance exports run synchronously on this thread.
            // A setTimeout cannot preempt a runaway guest. We set the timer to
            // mark abortFlag so any subsequent host call (log/abort/etc.) fails
            // fast, and we resolve quickly if the guest is well-behaved. For
            // hard-kill of runaway modules callers should run this instance in
            // a worker_thread and terminate it on timeout.
            const timer = setTimeout(() => {
                abortFlag.aborted = true;
                abortFlag.reason = `wasm process timeout after ${timeoutMs}ms`;
            }, timeoutMs);
            timer.unref();
            setWatchdog(timer);

            setImmediate(() => {
                try {
                    const result = invoke();
                    if (abortFlag.aborted && abortFlag.reason?.startsWith('wasm process timeout')) {
                        reject(new Error(abortFlag.reason));
                        return;
                    }
                    resolve(result);
                } catch (error: unknown) {
                    if (error instanceof WasmGuestAbort) {
                        reject(error);
                        return;
                    }
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            });
        });
    }

    private safeDealloc(exports: WasmGuestExports, ptr: number, len: number): void {
        if (ptr === 0 || len === 0) return;
        try {
            exports.dealloc(ptr, len);
        } catch (error: unknown) {
            logger.warn({ err: error }, '@wasm-plugin-instance: dealloc failed');
        }
    }
}

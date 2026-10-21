// Opens trajectory files with LammpsIO compiled to WebAssembly (packages/LammpsIO, src/wasm_bridge.cpp),
// the readers the cluster ingests uploads with. One module reads every file of a request, one at a
// time; the worker is discarded afterwards.
import type { TrajectoryFrame } from './read-trajectory';

export interface TrajectoryReaderRequest {
    files: File[];
    scriptUrl: string;
    wasmUrl: string;
}

// A frame as read from its own file; read-trajectory.ts assigns where it sits in the trajectory.
export type FileFrame = Omit<TrajectoryFrame, 'fileIndex'>;

// One entry per requested file, in request order.
export type FileReadResult =
    | { ok: true; format: string; frames: FileFrame[]; bytes: ArrayBuffer }
    | { ok: false; error: string };

export type TrajectoryReaderResponse =
    | { type: 'done'; results: FileReadResult[] }
    | { type: 'error'; message: string };

interface LammpsIoModule {
    _malloc: (size: number) => number;
    _free: (pointer: number) => void;
    _lammpsio_open: (data: number, size: number) => number;
    _lammpsio_read_frame: (index: number) => number;
    _lammpsio_close: () => void;
    UTF8ToString: (pointer: number) => string;
    HEAPU8: Uint8Array;
    HEAPU16: Uint16Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
}

type LammpsIoFactory = (options: { locateFile: (path: string) => string }) => Promise<LammpsIoModule>;

interface ScannedFrame {
    index: number;
    byteOffset: number;
    byteLength: number;
}

// Per-atom arrays are pointers into the module heap.
interface ReadFrame extends Omit<FileFrame, 'index' | 'byteOffset' | 'byteLength' | 'ids' | 'types' | 'positions'> {
    positions: number;
    types: number;
    ids: number | null;
}

const loadReader = async (scriptUrl: string, wasmUrl: string): Promise<LammpsIoModule> => {
    const response = await fetch(scriptUrl);
    if (!response.ok) {
        throw new Error(`Failed to load the trajectory reader (${response.status})`);
    }
    // The glue is a classic script declaring the createLammpsIoModule factory; evaluate it in global scope.
    (0, eval)(await response.text());
    const factory = (globalThis as typeof globalThis & { createLammpsIoModule?: LammpsIoFactory }).createLammpsIoModule;
    if (!factory) {
        throw new Error('The trajectory reader did not load');
    }
    return factory({ locateFile: (path) => (path.endsWith('.wasm') ? wasmUrl : new URL(path, scriptUrl).href) });
};

const parseResult = <T>(module: LammpsIoModule, pointer: number): T => {
    const value = JSON.parse(module.UTF8ToString(pointer)) as T | { error: string };
    if (typeof value === 'object' && value !== null && 'error' in value) {
        throw new Error(value.error);
    }
    return value as T;
};

const readFile = async (module: LammpsIoModule, file: File): Promise<FileReadResult> => {
    let buffer: ArrayBuffer;
    try {
        buffer = await file.arrayBuffer();
    } catch {
        return { ok: false, error: 'The file could not be opened' };
    }

    const pointer = module._malloc(Math.max(1, buffer.byteLength));
    module.HEAPU8.set(new Uint8Array(buffer), pointer);
    try {
        const scan = parseResult<{ format: string; frames: ScannedFrame[] }>(
            module,
            module._lammpsio_open(pointer, buffer.byteLength)
        );
        const frames = scan.frames.map((entry): FileFrame => {
            const { positions, types, ids, ...header } = parseResult<ReadFrame>(module, module._lammpsio_read_frame(entry.index));
            // Copied out: the module reuses these buffers for the next frame.
            return {
                ...header,
                index: entry.index,
                byteOffset: entry.byteOffset,
                byteLength: entry.byteLength,
                positions: module.HEAPF32.slice(positions >>> 2, (positions >>> 2) + header.natoms * 3),
                types: module.HEAPU16.slice(types >>> 1, (types >>> 1) + header.natoms),
                ids: ids === null ? null : module.HEAPU32.slice(ids >>> 2, (ids >>> 2) + header.natoms)
            };
        });
        return { ok: true, format: scan.format, frames, bytes: buffer };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
        module._lammpsio_close();
        module._free(pointer);
    }
};

const read = async ({ files, scriptUrl, wasmUrl }: TrajectoryReaderRequest): Promise<FileReadResult[]> => {
    const module = await loadReader(scriptUrl, wasmUrl);
    const results: FileReadResult[] = [];
    for (const file of files) {
        results.push(await readFile(module, file));
    }
    return results;
};

self.onmessage = (event: MessageEvent<TrajectoryReaderRequest>) => {
    read(event.data)
        .then((results) => {
            const transfer = results.flatMap((result): Transferable[] => (result.ok
                ? [result.bytes, ...result.frames.flatMap((frame) => [
                    frame.positions.buffer,
                    frame.types.buffer,
                    ...(frame.ids ? [frame.ids.buffer] : [])
                ])]
                : []));
            const response: TrajectoryReaderResponse = { type: 'done', results };
            self.postMessage(response, { transfer });
        })
        .catch((error: unknown) => {
            const response: TrajectoryReaderResponse = {
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            };
            self.postMessage(response);
        });
};

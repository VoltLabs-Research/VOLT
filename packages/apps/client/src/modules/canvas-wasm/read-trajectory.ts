import { WASM_PLUGIN_BASE_URL } from './constants';
import type { FileWithPath } from '@/shared/utils/file';
import type { FileReadResult, TrajectoryReaderRequest, TrajectoryReaderResponse } from './trajectory-reader-worker';

// One frame as LammpsIO read it: the same values the cluster stores when it ingests an upload.
export interface TrajectoryFrame {
    index: number;
    timestep: number;
    natoms: number;
    box: {
        xlo: number;
        xhi: number;
        ylo: number;
        yhi: number;
        zlo: number;
        zhi: number;
        xy: number;
        xz: number;
        yz: number;
    };
    cellVectors: [[number, number, number], [number, number, number], [number, number, number]];
    cellOrigin: [number, number, number];
    pbc: [boolean, boolean, boolean];
    // Null when the format has no atom ids (extxyz); atoms are then numbered from 1.
    ids: Uint32Array | null;
    types: Uint16Array;
    positions: Float32Array;
    // The file this frame comes from (LoadedTrajectory.files) and where it sits in it. Plugins
    // receive exactly these bytes, as on the cluster, which stores every frame as its byte range.
    fileIndex: number;
    byteOffset: number;
    byteLength: number;
}

export interface SkippedFile {
    path: string;
    reason: string;
}

export interface LoadedTrajectory {
    frames: TrajectoryFrame[];
    // Contents of the files that were read, indexed by TrajectoryFrame.fileIndex.
    files: Uint8Array[];
    totalSize: number;
    skipped: SkippedFile[];
    // Frames left out because an earlier file already had their timestep.
    duplicateTimesteps: number;
}

const readFiles = (files: File[]): Promise<FileReadResult[]> => {
    const baseUrl = new URL(`${WASM_PLUGIN_BASE_URL}/`, window.location.origin);
    const request: TrajectoryReaderRequest = {
        files,
        scriptUrl: new URL('lammpsio.js', baseUrl).href,
        wasmUrl: new URL('lammpsio.wasm', baseUrl).href
    };

    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./trajectory-reader-worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<TrajectoryReaderResponse>) => {
            worker.terminate();
            const message = event.data;
            if (message.type === 'done') {
                resolve(message.results);
            } else {
                reject(new Error(message.message));
            }
        };
        worker.onerror = (event) => {
            worker.terminate();
            reject(new Error(event.message || 'The trajectory reader crashed'));
        };
        worker.postMessage(request);
    });
};

// Whether a file is part of the trajectory is decided by the C++ readers from its contents, never
// from its name: files they do not read are skipped. Frames are merged like the cluster's
// TrajectoryIngestCommand does for a multi-file upload: the first frame of each timestep wins and
// the result is ordered by timestep. Files are taken in path order so a folder always loads the same.
export const readTrajectoryFiles = async (inputs: FileWithPath[]): Promise<LoadedTrajectory> => {
    const ordered = [...inputs].sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
    const results = await readFiles(ordered.map(({ file }) => file));

    const files: Uint8Array[] = [];
    const skipped: SkippedFile[] = [];
    const byTimestep = new Map<number, TrajectoryFrame>();
    let duplicateTimesteps = 0;
    let totalSize = 0;

    results.forEach((result, index) => {
        if (!result.ok) {
            skipped.push({ path: ordered[index].path, reason: result.error });
            return;
        }
        const fileIndex = files.length;
        let contributes = false;
        for (const frame of result.frames) {
            if (byTimestep.has(frame.timestep)) {
                duplicateTimesteps += 1;
                continue;
            }
            byTimestep.set(frame.timestep, { ...frame, fileIndex });
            contributes = true;
        }
        if (contributes) {
            files.push(new Uint8Array(result.bytes));
            totalSize += result.bytes.byteLength;
        }
    });

    return {
        frames: [...byTimestep.values()].sort((left, right) => left.timestep - right.timestep),
        files,
        totalSize,
        skipped,
        duplicateTimesteps
    };
};

// A copy, not a view: posting a view to a plugin worker would clone the whole file.
export const frameBytes = (files: Uint8Array[], frame: TrajectoryFrame): Uint8Array =>
    files[frame.fileIndex].slice(frame.byteOffset, frame.byteOffset + frame.byteLength);

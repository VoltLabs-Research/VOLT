import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileHandle } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

import {
    VTR_FRAME_INDEX_ENTRY_SIZE,
    VTR_KEYFRAME_NONE,
    VtrChunkCodec,
    VtrColumnData,
    VtrColumnEncoding,
    VtrColumnSchema,
    VtrColumnSemantic,
    VtrDtype,
    VtrFlag,
    VtrFrameChunkBody,
    VtrFrameIndexEntry,
    VtrFrameKind,
    VtrHeader,
    VtrTypeDictEntry,
    VtrZstdDictRef,
    VTR_CHUNK_FLAG_DEDUP,
    DEFAULT_KEYFRAME_INTERVAL
} from '@/modules/trajectory/contracts/vtr-format';
import {
    encodeFrameIndexEntry,
    encodeFooter,
    encodeVtrHeader
} from '@/modules/trajectory/infrastructure/codecs/vtr-header';
import { encodeFrameChunkBody } from '@/modules/trajectory/infrastructure/codecs/vtr-chunk';
import { zstdEncodeAsync } from '@/modules/trajectory/infrastructure/codecs/vtr-zstd';
import { crc32, crc32Combine } from '@/modules/trajectory/infrastructure/codecs/vtr-crc32';
import {
    buildMortonOrder,
    reorderFloat32,
    reorderFloat32Vec3,
    reorderUint16,
    reorderUint32
} from '@/modules/trajectory/infrastructure/codecs/vtr-morton';
import {
    computeBbox,
    quantizePositionsInt16,
    unionBbox
} from '@/modules/trajectory/infrastructure/codecs/vtr-quantize';
import { encodeDelta } from '@/modules/trajectory/infrastructure/codecs/vtr-delta';
import { safeRemovePath } from '@/support/fs/safe-remove-path';
import type { BlobStore } from '@/core/storage/infrastructure/BlobStore';

export interface VtrWriterFrameInput {
    timestep: number;
    atomCount: number;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: Record<string, Float32Array>;
}

export interface VtrWriterInit {
    outputPath: string;
    typeDict?: VtrTypeDictEntry[];
    customPropertyNames?: string[];
    lossless?: boolean;
    keyframeInterval?: number;
    useDelta?: boolean;
    useDedup?: boolean;
    useMortonOrder?: boolean;
    zstdLevel?: number;
    zstdDict?: { ref: VtrZstdDictRef; payload: Uint8Array };
    blobStore?: BlobStore;
    ownerClusterId?: string;
}

interface KeyframeState {
    atomCount: number;
    bbox: [number, number, number, number, number, number];
    quantizedPositions: Int16Array;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: Record<string, Float32Array>;
}

// Why: streaming layout. We write in two passes to a temp file:
//   pass 1 — [header placeholder][frame-index placeholder][frame chunks...]
//   pass 2 — overwrite header + index with final values, append footer
// RAM cost is bounded by one frame (keyframe) + the current frame.

const HEADER_PAD_BYTES = 8 * 1024;

export class VtrWriter {
    private readonly init: VtrWriterInit;
    private readonly keyframeInterval: number;
    private readonly lossless: boolean;
    private readonly useDelta: boolean;
    private readonly useDedup: boolean;
    private readonly useMortonOrder: boolean;
    private readonly zstdLevel: number;
    private readonly customPropertyNames: string[];

    private typeDict: VtrTypeDictEntry[];
    private columnSchema: VtrColumnSchema[] = [];
    private columnSchemaCommitted = false;

    private fileHandle: FileHandle | null = null;
    private headerReserved = HEADER_PAD_BYTES;
    private frameIndexEntries: VtrFrameIndexEntry[] = [];
    private frameChunkCursor = 0;
    private crcRunning = 0;
    private globalBbox: [number, number, number, number, number, number] = [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY
    ];
    private atomMax = 0;
    private keyframe: KeyframeState | null = null;
    private keyframeIndex = 0;
    private finalised = false;

    public constructor(init: VtrWriterInit) {
        this.init = init;
        this.keyframeInterval = init.keyframeInterval ?? DEFAULT_KEYFRAME_INTERVAL;
        this.lossless = init.lossless ?? true;
        this.useDelta = init.useDelta ?? !this.lossless;
        this.useDedup = init.useDedup ?? false;
        this.useMortonOrder = init.useMortonOrder ?? true;
        this.zstdLevel = init.zstdLevel ?? 10;
        this.typeDict = init.typeDict ?? [];
        this.customPropertyNames = init.customPropertyNames ?? [];
    }

    public async open(): Promise<void> {
        await fs.mkdir(path.dirname(this.init.outputPath), { recursive: true });
        this.fileHandle = await fs.open(this.init.outputPath, 'w+');
        // Why: pre-size the header region with zero padding so we can overwrite
        // it at the end without shifting chunk offsets.
        const padding = new Uint8Array(this.headerReserved);
        await this.fileHandle.write(padding, 0, padding.byteLength, 0);
        this.frameChunkCursor = this.headerReserved;
    }

    public async writeFrame(frame: VtrWriterFrameInput): Promise<void> {
        if (!this.fileHandle) throw new Error('VtrWriter.open() must be called before writeFrame');
        if (this.finalised) throw new Error('VtrWriter already finalised');

        const frameIndex = this.frameIndexEntries.length;
        const isKeyframe = this.useDelta
            ? (frameIndex % this.keyframeInterval === 0) || this.keyframe === null
            : true;

        const frameBbox = computeBbox(frame.positions, frame.atomCount);
        unionBbox(this.globalBbox, frameBbox);
        if (frame.atomCount > this.atomMax) this.atomMax = frame.atomCount;

        let positions = frame.positions;
        let types = frame.types;
        let ids = frame.ids;
        let properties = frame.properties;

        if (this.useMortonOrder) {
            const { order } = buildMortonOrder(positions, frame.atomCount, frameBbox);
            positions = reorderFloat32Vec3(positions, order);
            types = reorderUint16(types, order);
            if (ids) ids = reorderUint32(ids, order);
            if (properties) {
                const reorderedProps: Record<string, Float32Array> = {};
                for (const [key, values] of Object.entries(properties)) {
                    reorderedProps[key] = reorderFloat32(values, order);
                }
                properties = reorderedProps;
            }
        }

        const columns: VtrColumnData[] = [];

        if (isKeyframe) {
            const positionColumn = this.encodePositionsKeyframe(positions, frame.atomCount, frameBbox);
            columns.push(positionColumn.column);
            this.keyframe = {
                atomCount: frame.atomCount,
                bbox: [...frameBbox] as [number, number, number, number, number, number],
                quantizedPositions: positionColumn.quantized,
                positions: positions.slice(),
                types: types.slice(),
                ids: ids ? ids.slice() : undefined,
                properties: properties
                    ? Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, v.slice()]))
                    : undefined
            };
            this.keyframeIndex = frameIndex;
        } else {
            if (!this.keyframe) throw new Error('delta frame requested with no keyframe available');
            if (this.keyframe.atomCount !== frame.atomCount) {
                // Why: delta streams require a stable atom count. Fall back to a
                // fresh keyframe if topology changed.
                const positionColumn = this.encodePositionsKeyframe(positions, frame.atomCount, frameBbox);
                columns.push(positionColumn.column);
                this.keyframe = {
                    atomCount: frame.atomCount,
                    bbox: [...frameBbox] as [number, number, number, number, number, number],
                    quantizedPositions: positionColumn.quantized,
                    positions: positions.slice(),
                    types: types.slice(),
                    ids: ids ? ids.slice() : undefined,
                    properties: properties
                        ? Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, v.slice()]))
                        : undefined
                };
                this.keyframeIndex = frameIndex;
            } else {
                const quantized = quantizePositionsInt16(positions, frame.atomCount, this.keyframe.bbox);
                const delta = encodeDelta(quantized, this.keyframe.quantizedPositions);
                const dtype = delta.kind === 'int8' ? VtrDtype.DeltaInt8 : VtrDtype.DeltaInt16;
                const payload = delta.kind === 'int8'
                    ? new Uint8Array(delta.data.buffer, delta.data.byteOffset, delta.data.byteLength)
                    : new Uint8Array(delta.data.buffer, delta.data.byteOffset, delta.data.byteLength);
                columns.push({
                    name: 'positions',
                    dtype,
                    encoding: VtrColumnEncoding.Delta,
                    data: payload,
                    bbox: this.keyframe.bbox
                });
            }
        }

        columns.push({
            name: 'types',
            dtype: VtrDtype.TypesU16,
            encoding: VtrColumnEncoding.Raw,
            data: new Uint8Array(types.buffer, types.byteOffset, types.byteLength)
        });

        if (ids) {
            columns.push({
                name: 'ids',
                dtype: VtrDtype.IdsU32,
                encoding: VtrColumnEncoding.Raw,
                data: new Uint8Array(ids.buffer, ids.byteOffset, ids.byteLength)
            });
        }

        if (properties) {
            for (const name of this.customPropertyNames) {
                const values = properties[name];
                if (!values) continue;
                columns.push({
                    name,
                    dtype: VtrDtype.CustomF32,
                    encoding: VtrColumnEncoding.Raw,
                    data: new Uint8Array(values.buffer, values.byteOffset, values.byteLength)
                });
            }
        }

        this.commitColumnSchema(columns);

        const frameKind = isKeyframe ? VtrFrameKind.Independent : VtrFrameKind.Predictive;
        const body: VtrFrameChunkBody = {
            frameKind,
            flags: 0,
            frameBbox,
            columns
        };
        const bodyBytes = encodeFrameChunkBody(body);

        const dictPayload = this.init.zstdDict?.payload;
        const compressed = await zstdEncodeAsync(bodyBytes, { level: this.zstdLevel, dict: dictPayload });
        const codecId = dictPayload ? VtrChunkCodec.ZstdDict : VtrChunkCodec.ZstdPlain;

        let payloadToWrite = compressed;
        let chunkFlags = 0;
        if (this.useDedup && this.init.blobStore && this.init.ownerClusterId) {
            const result = await this.init.blobStore.put(this.init.ownerClusterId, compressed);
            const dedupBody: VtrFrameChunkBody = {
                frameKind,
                flags: VTR_CHUNK_FLAG_DEDUP,
                frameBbox,
                columns: [],
                dedupRef: { hash: result.hash, size: compressed.byteLength }
            };
            payloadToWrite = encodeFrameChunkBody(dedupBody);
            chunkFlags = VTR_CHUNK_FLAG_DEDUP;
        }

        const offset = this.frameChunkCursor;
        await this.fileHandle.write(payloadToWrite, 0, payloadToWrite.byteLength, offset);
        this.frameChunkCursor += payloadToWrite.byteLength;

        const chunkCrc = crc32(payloadToWrite);
        this.crcRunning = crc32Combine(this.crcRunning, payloadToWrite);

        this.frameIndexEntries.push({
            offset,
            compressedSize: payloadToWrite.byteLength,
            uncompressedSize: bodyBytes.byteLength,
            atomCount: frame.atomCount,
            timestep: frame.timestep,
            frameKind,
            chunkCodecId: codecId,
            keyframeIndex: isKeyframe ? VTR_KEYFRAME_NONE : this.keyframeIndex,
            crc32: chunkCrc
        });

        void chunkFlags;
    }

    public async finalize(): Promise<{ path: string; size: number; frameCount: number }> {
        if (!this.fileHandle) throw new Error('VtrWriter.open() must be called before finalize');
        if (this.finalised) throw new Error('VtrWriter already finalised');

        const flags = this.computeFlags();
        const zstdDictRef: VtrZstdDictRef | null = this.init.zstdDict ? this.init.zstdDict.ref : null;

        const normalizedBbox: [number, number, number, number, number, number] =
            Number.isFinite(this.globalBbox[0])
                ? this.globalBbox
                : [0, 0, 0, 0, 0, 0];

        const header: VtrHeader = {
            version: 1,
            flags,
            frameCount: this.frameIndexEntries.length,
            atomMax: this.atomMax,
            bbox: normalizedBbox,
            typeDict: this.typeDict,
            columnSchema: this.columnSchema,
            zstdDict: zstdDictRef,
            frameIndexOffset: 0
        };

        const headerBytes = encodeVtrHeader(header);
        const frameIndexSize = this.frameIndexEntries.length * VTR_FRAME_INDEX_ENTRY_SIZE;
        const headerPlusIndex = headerBytes.byteLength + frameIndexSize;
        if (headerPlusIndex > this.headerReserved) {
            await this.expandHeaderRegion(headerPlusIndex);
        }

        const prelude = new Uint8Array(this.headerReserved);
        prelude.set(headerBytes, 0);
        let cursor = headerBytes.byteLength;
        for (const entry of this.frameIndexEntries) {
            prelude.set(encodeFrameIndexEntry(entry), cursor);
            cursor += VTR_FRAME_INDEX_ENTRY_SIZE;
        }

        await this.fileHandle.write(prelude, 0, prelude.byteLength, 0);
        const preludeCrc = crc32(prelude);
        const combined = crc32Combine(preludeCrc, new Uint8Array(0));
        const footer = encodeFooter(combined);
        await this.fileHandle.write(footer, 0, footer.byteLength, this.frameChunkCursor);

        const totalSize = this.frameChunkCursor + footer.byteLength;
        await this.fileHandle.truncate(totalSize);
        await this.fileHandle.close();
        this.fileHandle = null;
        this.finalised = true;

        return {
            path: this.init.outputPath,
            size: totalSize,
            frameCount: this.frameIndexEntries.length
        };
    }

    public async abort(): Promise<void> {
        if (this.fileHandle) {
            await this.fileHandle.close().catch(() => {});
            this.fileHandle = null;
        }
        await safeRemovePath(this.init.outputPath);
    }

    public createReadableStream(): Readable {
        if (!this.finalised) throw new Error('VtrWriter: finalize() must run before streaming the output');
        return createReadStream(this.init.outputPath);
    }

    public getFrameCount(): number {
        return this.frameIndexEntries.length;
    }

    private commitColumnSchema(columns: VtrColumnData[]): void {
        if (this.columnSchemaCommitted) return;
        this.columnSchema = columns.map((column) => ({
            name: column.name,
            dtype: column.dtype,
            semantic: mapSemantic(column.name, column.dtype)
        }));
        this.columnSchemaCommitted = true;
    }

    private computeFlags(): number {
        let flags = 0;
        if (this.typeDict.length > 0) flags |= VtrFlag.HasTypeDict;
        if (this.init.zstdDict) flags |= VtrFlag.HasZstdDict;
        if (this.lossless) flags |= VtrFlag.Lossless;
        if (this.useDelta) flags |= VtrFlag.UseDelta;
        if (this.useDedup) flags |= VtrFlag.UseDedup;
        if (this.useMortonOrder) flags |= VtrFlag.UseMortonOrder;
        return flags;
    }

    private encodePositionsKeyframe(
        positions: Float32Array,
        atomCount: number,
        frameBbox: readonly [number, number, number, number, number, number]
    ): { column: VtrColumnData; quantized: Int16Array } {
        if (this.lossless) {
            const quantized = quantizePositionsInt16(positions, atomCount, frameBbox);
            const data = new Uint8Array(
                positions.buffer,
                positions.byteOffset,
                positions.byteLength
            );
            return {
                column: {
                    name: 'positions',
                    dtype: VtrDtype.PositionsF32,
                    encoding: VtrColumnEncoding.Raw,
                    data
                },
                quantized
            };
        }

        const quantized = quantizePositionsInt16(positions, atomCount, frameBbox);
        return {
            column: {
                name: 'positions',
                dtype: VtrDtype.PositionsInt16Norm,
                encoding: VtrColumnEncoding.QuantizedInt16,
                data: new Uint8Array(quantized.buffer, quantized.byteOffset, quantized.byteLength),
                bbox: frameBbox
            },
            quantized
        };
    }

    private async expandHeaderRegion(minBytes: number): Promise<void> {
        // Why: if the real header+index exceed the padded prelude we pre-wrote,
        // we have to shift every chunk forward. This path is rare (only triggered
        // for very large trajectories with many custom columns) but still RAM-safe:
        // we shift in 8 MB chunks.
        if (!this.fileHandle) throw new Error('VtrWriter: file handle closed');
        const newReserved = Math.max(minBytes, this.headerReserved * 2);
        const delta = newReserved - this.headerReserved;
        const SHIFT_BUFFER = 8 * 1024 * 1024;
        const scratch = new Uint8Array(SHIFT_BUFFER);

        // Shift from the tail so we don't overwrite data we still need to move.
        let readCursor = this.frameChunkCursor;
        while (readCursor > this.headerReserved) {
            const chunkSize = Math.min(SHIFT_BUFFER, readCursor - this.headerReserved);
            readCursor -= chunkSize;
            const read = await this.fileHandle.read(scratch, 0, chunkSize, readCursor);
            await this.fileHandle.write(scratch, 0, read.bytesRead, readCursor + delta);
        }

        const pad = new Uint8Array(delta);
        await this.fileHandle.write(pad, 0, pad.byteLength, this.headerReserved);

        this.headerReserved = newReserved;
        this.frameChunkCursor += delta;
        for (const entry of this.frameIndexEntries) {
            entry.offset += delta;
        }
    }
}

const mapSemantic = (name: string, dtype: VtrDtype): VtrColumnSemantic => {
    if (name === 'positions' || dtype === VtrDtype.PositionsF32 || dtype === VtrDtype.PositionsInt16Norm || dtype === VtrDtype.DeltaInt8 || dtype === VtrDtype.DeltaInt16) {
        return VtrColumnSemantic.Position;
    }
    if (name === 'types' || dtype === VtrDtype.TypesU16) return VtrColumnSemantic.Type;
    if (name === 'ids' || dtype === VtrDtype.IdsU32) return VtrColumnSemantic.Id;
    return VtrColumnSemantic.Custom;
};

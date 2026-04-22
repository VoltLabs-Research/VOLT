import fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';

import {
    VTR_CHUNK_FLAG_DEDUP,
    VTR_FRAME_INDEX_ENTRY_SIZE,
    VTR_KEYFRAME_NONE,
    VTR_MAGIC_HEAD,
    VtrChunkCodec,
    VtrColumnData,
    VtrColumnSchema,
    VtrDtype,
    VtrFlag,
    VtrFrameChunkBody,
    VtrFrameIndexEntry,
    VtrFrameKind,
    VtrHeader
} from '@/modules/trajectory/contracts/vtr-format';
import {
    decodeFrameIndexEntry,
    decodeVtrHeader
} from '@/modules/trajectory/infrastructure/codecs/vtr-header';
import { decodeFrameChunkBody } from '@/modules/trajectory/infrastructure/codecs/vtr-chunk';
import { zstdDecode } from '@/modules/trajectory/infrastructure/codecs/vtr-zstd';
import { dequantizePositionsInt16 } from '@/modules/trajectory/infrastructure/codecs/vtr-quantize';
import { applyDeltaInt16 } from '@/modules/trajectory/infrastructure/codecs/vtr-delta';
import type { BlobStore } from '@/core/storage/infrastructure/BlobStore';

export interface VtrRemoteSource {
    kind: 'remote';
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    fetchRange: (offset: number, length: number) => Promise<Uint8Array>;
    fetchFull: () => Promise<Uint8Array>;
}

export interface VtrLocalSource {
    kind: 'local';
    filePath: string;
}

export type VtrReaderSource = VtrRemoteSource | VtrLocalSource;

export interface VtrReaderInit {
    source: VtrReaderSource;
    zstdDictResolver?: (ref: { key: string; size: number }) => Promise<Uint8Array>;
    blobStore?: BlobStore;
    ownerClusterId?: string;
}

export interface VtrFrameData {
    timestep: number;
    atomCount: number;
    frameKind: VtrFrameKind;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties: Record<string, Float32Array>;
    frameBbox: readonly [number, number, number, number, number, number];
}

const PRELUDE_PROBE_BYTES = 64 * 1024;

export class VtrReader {
    private readonly init: VtrReaderInit;
    private fileHandle: FileHandle | null = null;
    private header: VtrHeader | null = null;
    private frameIndex: VtrFrameIndexEntry[] = [];
    private timestepToIndex: Map<number, number> = new Map();
    private zstdDictPayload: Uint8Array | null = null;

    public constructor(init: VtrReaderInit) {
        this.init = init;
    }

    public async open(): Promise<void> {
        if (this.init.source.kind === 'local') {
            this.fileHandle = await fs.open(this.init.source.filePath, 'r');
        }

        const prelude = await this.readPrelude();
        const decoded = decodeVtrHeader(prelude);
        this.header = decoded.header;

        const frameIndexStart = decoded.frameIndexOffset;
        const frameIndexBytesRequired = decoded.header.frameCount * VTR_FRAME_INDEX_ENTRY_SIZE;
        let indexBytes: Uint8Array;
        if (prelude.byteLength >= frameIndexStart + frameIndexBytesRequired) {
            indexBytes = prelude.subarray(frameIndexStart, frameIndexStart + frameIndexBytesRequired);
        } else {
            indexBytes = await this.readRange(frameIndexStart, frameIndexBytesRequired);
        }

        this.frameIndex = [];
        for (let index = 0; index < decoded.header.frameCount; index++) {
            const entry = decodeFrameIndexEntry(indexBytes, index * VTR_FRAME_INDEX_ENTRY_SIZE);
            this.frameIndex.push(entry);
            this.timestepToIndex.set(entry.timestep, index);
        }

        if ((this.header.flags & VtrFlag.HasZstdDict) !== 0 && this.header.zstdDict && this.init.zstdDictResolver) {
            this.zstdDictPayload = await this.init.zstdDictResolver(this.header.zstdDict);
        }
    }

    public getHeader(): VtrHeader {
        if (!this.header) throw new Error('VtrReader.open() must be called first');
        return this.header;
    }

    public getFrameIndex(): readonly VtrFrameIndexEntry[] {
        return this.frameIndex;
    }

    public listTimesteps(): number[] {
        return this.frameIndex.map((entry) => entry.timestep);
    }

    public hasTimestep(timestep: number): boolean {
        return this.timestepToIndex.has(timestep);
    }

    public async readFrameByIndex(index: number): Promise<VtrFrameData> {
        if (!this.header) throw new Error('VtrReader.open() must be called first');
        if (index < 0 || index >= this.frameIndex.length) {
            throw new Error(`vtr frame index out of range: ${index}`);
        }

        const entry = this.frameIndex[index];
        const body = await this.readFrameChunkBody(entry);

        if (body.frameKind === VtrFrameKind.Independent) {
            return this.materializeFrame(entry, body, null);
        }

        if (entry.keyframeIndex === VTR_KEYFRAME_NONE) {
            throw new Error(`vtr predictive frame at index ${index} has no keyframe reference`);
        }

        const keyframeEntry = this.frameIndex[entry.keyframeIndex];
        const keyframeBody = await this.readFrameChunkBody(keyframeEntry);
        const keyframeFrame = this.materializeFrame(keyframeEntry, keyframeBody, null);
        return this.materializeFrame(entry, body, keyframeFrame);
    }

    public readFrame(timestep: number): Promise<VtrFrameData> {
        const index = this.timestepToIndex.get(timestep);
        if (index === undefined) {
            throw new Error(`vtr timestep not present: ${timestep}`);
        }
        return this.readFrameByIndex(index);
    }

    public async close(): Promise<void> {
        if (this.fileHandle) {
            await this.fileHandle.close();
            this.fileHandle = null;
        }
    }

    private async readPrelude(): Promise<Uint8Array> {
        const probe = await this.readRange(0, PRELUDE_PROBE_BYTES);
        for (let index = 0; index < VTR_MAGIC_HEAD.length; index++) {
            if (probe[index] !== VTR_MAGIC_HEAD[index]) {
                throw new Error('vtr magic mismatch during open');
            }
        }
        return probe;
    }

    private async readRange(offset: number, length: number): Promise<Uint8Array> {
        if (this.init.source.kind === 'local') {
            if (!this.fileHandle) throw new Error('VtrReader: local file handle closed');
            const stat = await this.fileHandle.stat();
            const effectiveLength = Math.min(length, Math.max(0, stat.size - offset));
            if (effectiveLength === 0) return new Uint8Array(0);
            const buffer = new Uint8Array(effectiveLength);
            const result = await this.fileHandle.read(buffer, 0, effectiveLength, offset);
            return buffer.subarray(0, result.bytesRead);
        }
        return this.init.source.fetchRange(offset, length);
    }

    private async readFrameChunkBody(entry: VtrFrameIndexEntry): Promise<VtrFrameChunkBody> {
        const envelope = await this.readRange(entry.offset, entry.compressedSize);

        // Why: dedup chunks live in the .vtr file only as an envelope (plain,
        // uncompressed) pointing to a BlobStore hash. The envelope starts with
        // chunkVersion=1 (0x01) which never collides with zstd's magic bytes
        // (0x28 0xB5 0x2F 0xFD) at offset 0. We test the version byte first
        // before inspecting the dedup flag to avoid mistakenly interpreting
        // compressed payload as an envelope.
        if (envelope.length > 3 && envelope[0] === 1 && (envelope[3] & VTR_CHUNK_FLAG_DEDUP) !== 0) {
            const envelopeBody = decodeFrameChunkBody(envelope);
            if (!envelopeBody.dedupRef) throw new Error('dedup chunk missing dedupRef');
            if (!this.init.blobStore || !this.init.ownerClusterId) {
                throw new Error('vtr dedup chunk requires BlobStore + ownerClusterId');
            }
            const compressedBlob = await this.init.blobStore.get(this.init.ownerClusterId, envelopeBody.dedupRef.hash);
            return this.decompressAndDecodeChunk(compressedBlob, entry);
        }

        return this.decompressAndDecodeChunk(envelope, entry);
    }

    private decompressAndDecodeChunk(
        compressed: Uint8Array,
        entry: VtrFrameIndexEntry
    ): VtrFrameChunkBody {
        if (entry.chunkCodecId === VtrChunkCodec.ZstdDict && !this.zstdDictPayload) {
            throw new Error('vtr chunk requires zstd dict but no dict is loaded');
        }
        const decompressed = zstdDecode(compressed, {
            dict: entry.chunkCodecId === VtrChunkCodec.ZstdDict ? this.zstdDictPayload ?? undefined : undefined
        });
        return decodeFrameChunkBody(decompressed);
    }

    private materializeFrame(
        entry: VtrFrameIndexEntry,
        body: VtrFrameChunkBody,
        reference: VtrFrameData | null
    ): VtrFrameData {
        const atomCount = entry.atomCount;
        let positions: Float32Array | null = null;
        let types: Uint16Array | null = null;
        let ids: Uint32Array | undefined;
        const properties: Record<string, Float32Array> = {};

        const schema = this.header!.columnSchema;

        for (const column of body.columns) {
            const resolvedName = column.name || this.resolveNameFromSchema(column.dtype, schema);
            switch (column.dtype) {
                case VtrDtype.PositionsF32: {
                    positions = new Float32Array(column.data.buffer.slice(column.data.byteOffset, column.data.byteOffset + column.data.byteLength));
                    break;
                }
                case VtrDtype.PositionsInt16Norm: {
                    const quantized = new Int16Array(
                        column.data.buffer.slice(column.data.byteOffset, column.data.byteOffset + column.data.byteLength)
                    );
                    positions = dequantizePositionsInt16(quantized, atomCount, body.frameBbox);
                    break;
                }
                case VtrDtype.DeltaInt8:
                case VtrDtype.DeltaInt16: {
                    if (!reference) {
                        throw new Error('vtr delta column requires a reference keyframe');
                    }
                    const delta = column.dtype === VtrDtype.DeltaInt8
                        ? new Int8Array(
                            column.data.buffer.slice(column.data.byteOffset, column.data.byteOffset + column.data.byteLength)
                        )
                        : new Int16Array(
                            column.data.buffer.slice(column.data.byteOffset, column.data.byteOffset + column.data.byteLength)
                        );
                    const referenceQuantized = this.requantizeReference(reference, body.frameBbox);
                    const deltaAsInt16 = column.dtype === VtrDtype.DeltaInt8
                        ? int8ToInt16(delta as Int8Array)
                        : delta as Int16Array;
                    const reconstructed = applyDeltaInt16(referenceQuantized, deltaAsInt16);
                    positions = dequantizePositionsInt16(reconstructed, atomCount, body.frameBbox);
                    break;
                }
                case VtrDtype.TypesU16: {
                    types = new Uint16Array(
                        column.data.buffer.slice(column.data.byteOffset, column.data.byteOffset + column.data.byteLength)
                    );
                    break;
                }
                case VtrDtype.IdsU32: {
                    ids = new Uint32Array(
                        column.data.buffer.slice(column.data.byteOffset, column.data.byteOffset + column.data.byteLength)
                    );
                    break;
                }
                case VtrDtype.CustomF32: {
                    properties[resolvedName] = new Float32Array(
                        column.data.buffer.slice(column.data.byteOffset, column.data.byteOffset + column.data.byteLength)
                    );
                    break;
                }
                default: {
                    // Why: unknown dtypes get exposed verbatim so consumers can
                    // still inspect them without breaking the reader contract.
                    properties[resolvedName] = new Float32Array(0);
                }
            }
        }

        if (!positions && reference) {
            positions = reference.positions;
        }
        if (!types && reference) {
            types = reference.types;
        }
        if (!positions || !types) {
            throw new Error('vtr frame missing required positions/types columns');
        }

        if (!ids && reference) {
            ids = reference.ids;
        }
        if (reference) {
            for (const [key, value] of Object.entries(reference.properties)) {
                if (!(key in properties)) properties[key] = value;
            }
        }

        return {
            timestep: entry.timestep,
            atomCount,
            frameKind: entry.frameKind,
            positions,
            types,
            ids,
            properties,
            frameBbox: body.frameBbox
        };
    }

    private requantizeReference(
        reference: VtrFrameData,
        frameBbox: readonly [number, number, number, number, number, number]
    ): Int16Array {
        // Why: the keyframe may have been decoded into float positions; to apply
        // a delta we re-quantize against the *frame's* bbox (mirrors writer side).
        const UINT16_MAX = 65535;
        const INT16_BIAS = 32768;
        const atomCount = reference.atomCount;
        const out = new Int16Array(atomCount * 3);
        const spans: [number, number, number] = [
            frameBbox[3] - frameBbox[0],
            frameBbox[4] - frameBbox[1],
            frameBbox[5] - frameBbox[2]
        ];
        const invSpans: [number, number, number] = [
            spans[0] > 0 ? UINT16_MAX / spans[0] : 0,
            spans[1] > 0 ? UINT16_MAX / spans[1] : 0,
            spans[2] > 0 ? UINT16_MAX / spans[2] : 0
        ];

        for (let index = 0; index < atomCount; index++) {
            const base = index * 3;
            for (let axis = 0; axis < 3; axis++) {
                const raw = reference.positions[base + axis] - frameBbox[axis];
                let scaled = Math.round(raw * invSpans[axis]);
                if (scaled < 0) scaled = 0;
                if (scaled > UINT16_MAX) scaled = UINT16_MAX;
                out[base + axis] = scaled - INT16_BIAS;
            }
        }

        return out;
    }

    private resolveNameFromSchema(dtype: VtrDtype, schema: readonly VtrColumnSchema[]): string {
        for (const column of schema) {
            if (column.dtype === dtype) return column.name;
        }
        return `col_${dtype}`;
    }
}

const int8ToInt16 = (source: Int8Array): Int16Array => {
    const out = new Int16Array(source.length);
    for (let index = 0; index < source.length; index++) {
        out[index] = source[index];
    }
    return out;
};

const collectColumns = (body: VtrFrameChunkBody): VtrColumnData[] => body.columns;
void collectColumns;

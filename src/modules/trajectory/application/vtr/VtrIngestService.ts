import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { BlobStore } from '@/core/storage/infrastructure/BlobStore';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import {
    DEFAULT_KEYFRAME_INTERVAL,
    VTR_DICT_BUCKET,
    VtrZstdDictRef
} from '@/modules/trajectory/contracts/vtr-format';
import { VtrWriter } from '@/modules/trajectory/infrastructure/codecs/vtr-writer';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { toVtrObjectKey } from '@/support/serialization/storage-codec';
import { dataParser, dumpParser, type NativeParseResult } from '@voltstack/lammps-io';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';

import type { DictionaryTrainer } from '@/modules/trajectory/application/vtr/DictionaryTrainer';

export interface VtrIngestFrameSource {
    timestep: number;
    dumpPath: string;
}

export interface VtrIngestInput {
    trajectoryId: string;
    ownerClusterId: string;
    frames: VtrIngestFrameSource[];
    lossless?: boolean;
    keyframeInterval?: number;
    useDedup?: boolean;
    zstdLevel?: number;
    customProperties?: string[];
}

export interface VtrIngestResult {
    objectKey: string;
    frameCount: number;
    size: number;
    bucket: ObjectBucketName;
}

const readFrameFromFile = (filePath: string, includeProperties: string[] | undefined): NativeParseResult => {
    const dumpResult = dumpParser.parseDump(filePath, {
        includeIds: true,
        properties: includeProperties ?? []
    });
    if (dumpResult) return dumpResult;

    const dataResult = dataParser.parseData(filePath, { includeIds: true });
    if (dataResult) return dataResult;

    throw new Error(`Unsupported trajectory format: ${filePath}`);
};

@Service('vtrIngestService')
export class VtrIngestService {
    public constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly blobStore: BlobStore,
        private readonly dictionaryTrainer: DictionaryTrainer
    ) {}

    public async ingest(input: VtrIngestInput): Promise<VtrIngestResult> {
        if (input.frames.length === 0) {
            throw new Error(`vtr ingest requested with empty frame list for trajectoryId=${input.trajectoryId}`);
        }

        return withNativeProcessingTempDir('vtr-ingest', async (tempDirectory) => {
            const outputPath = path.join(tempDirectory, `${input.trajectoryId}.vtr`);
            const zstdDict = await this.dictionaryTrainer.resolveLatestDict(input.ownerClusterId).catch((error) => {
                logger.warn(`@vtr-ingest: dict resolution failed — proceeding without dict: ${String(error)}`);
                return null;
            });
            const lossless = input.lossless ?? true;

            const writer = new VtrWriter({
                outputPath,
                lossless,
                keyframeInterval: input.keyframeInterval ?? DEFAULT_KEYFRAME_INTERVAL,
                useDelta: !lossless,
                useDedup: input.useDedup ?? false,
                useMortonOrder: true,
                zstdLevel: input.zstdLevel ?? 10,
                customPropertyNames: input.customProperties ?? [],
                blobStore: this.blobStore,
                ownerClusterId: input.ownerClusterId,
                zstdDict: zstdDict ?? undefined
            });

            try {
                await writer.open();

                const sortedFrames = [...input.frames].sort((a, b) => a.timestep - b.timestep);
                for (const frame of sortedFrames) {
                    const parsed = readFrameFromFile(frame.dumpPath, input.customProperties);
                    const atomCount = parsed.positions.length / 3;
                    const properties = toFloat32PropertyMap(parsed.properties);
                    await writer.writeFrame({
                        timestep: frame.timestep,
                        atomCount,
                        positions: parsed.positions,
                        types: parsed.types,
                        ids: parsed.ids instanceof Uint32Array ? parsed.ids : parsed.ids
                            ? Uint32Array.from(parsed.ids as ArrayLike<number>)
                            : undefined,
                        properties
                    });
                }

                const finalized = await writer.finalize();
                const stat = await fs.stat(finalized.path);
                const objectKey = toVtrObjectKey(input.trajectoryId);

                await this.objectStore.putObjectStream({
                    ownerClusterId: input.ownerClusterId,
                    bucket: ObjectBucketName.Vtr,
                    objectKey,
                    stream: createReadStream(finalized.path),
                    size: stat.size,
                    metadata: {
                        'Content-Type': 'application/octet-stream',
                        'x-vtr-frame-count': String(finalized.frameCount),
                        'x-vtr-dict-bucket': VTR_DICT_BUCKET,
                        ...(zstdDict ? { 'x-vtr-dict-key': zstdDict.ref.key, 'x-vtr-dict-size': String(zstdDict.ref.size) } : {})
                    }
                });

                return {
                    objectKey,
                    frameCount: finalized.frameCount,
                    size: stat.size,
                    bucket: ObjectBucketName.Vtr
                };
            } catch (error) {
                await writer.abort();
                throw error;
            }
        });
    }
}

const toFloat32PropertyMap = (
    properties: NativeParseResult['properties']
): Record<string, Float32Array> | undefined => {
    if (!properties) return undefined;
    const entries = Object.entries(properties);
    if (entries.length === 0) return undefined;
    const result: Record<string, Float32Array> = {};
    for (const [name, values] of entries) {
        if (values instanceof Float32Array) {
            result[name] = values;
            continue;
        }
        if (values instanceof Float64Array) {
            result[name] = Float32Array.from(values);
            continue;
        }
        result[name] = Float32Array.from(values as ArrayLike<number>);
    }
    return result;
};

export const vtrIngestResultToReaderSource = (result: VtrIngestResult): { bucket: string; objectKey: string } => ({
    bucket: result.bucket,
    objectKey: result.objectKey
});

export { VtrZstdDictRef };

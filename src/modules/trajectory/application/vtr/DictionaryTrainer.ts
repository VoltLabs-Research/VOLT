import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { VTR_DICT_BUCKET } from '@/modules/trajectory/contracts/vtr-format';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { toVtrDictObjectKey } from '@/support/serialization/storage-codec';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

// Why: zstd dictionary training (F2.S3). Training happens out-of-band: a job
// pulls ~100 random frames from the cluster, feeds them to `zstd --train`, and
// uploads the resulting dict to the VTR dict bucket. At write/read time the
// writer/reader look up the dict once per ingest and cache it in memory.

export interface TrainedDictInfo {
    key: string;
    size: number;
    version: number;
    payload: Uint8Array;
}

export interface TrainerResolvedDict {
    ref: { key: string; size: number };
    payload: Uint8Array;
}

interface TrainDictInput {
    ownerClusterId: string;
    sampleFramePaths: string[];
    maxDictSizeBytes?: number;
}

const DEFAULT_MAX_DICT_BYTES = 128 * 1024;
const DICT_SAMPLE_CAP = 100;

@Service('dictionaryTrainer')
export class DictionaryTrainer {
    private readonly cache = new Map<string, TrainerResolvedDict>();

    public constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    public async resolveLatestDict(ownerClusterId: string): Promise<TrainerResolvedDict | null> {
        const cached = this.cache.get(ownerClusterId);
        if (cached) return cached;

        const latest = await this.findLatestDictKey(ownerClusterId);
        if (!latest) return null;

        const response = await this.objectStore.getStream(
            ownerClusterId,
            ObjectBucketName.VtrDict,
            latest.objectKey,
            { skipMetadata: true }
        );
        const payload = await streamToBuffer(response.stream);
        const resolved: TrainerResolvedDict = {
            ref: { key: latest.objectKey, size: payload.byteLength },
            payload
        };
        this.cache.set(ownerClusterId, resolved);
        return resolved;
    }

    public async trainAndUpload(input: TrainDictInput): Promise<TrainedDictInfo> {
        const samples = input.sampleFramePaths.slice(0, DICT_SAMPLE_CAP);
        if (samples.length === 0) {
            throw new Error('dictionary trainer requires at least one sample frame');
        }

        const maxDictBytes = input.maxDictSizeBytes ?? DEFAULT_MAX_DICT_BYTES;

        return withNativeProcessingTempDir('vtr-dict', async (tempDirectory) => {
            const dictPath = path.join(tempDirectory, 'trajectory.dict');
            const args = [
                '--train',
                ...samples,
                '--maxdict', String(maxDictBytes),
                '-o', dictPath
            ];

            await runZstd(args);

            const payloadBuffer = await fs.readFile(dictPath);
            const payload = new Uint8Array(payloadBuffer.buffer, payloadBuffer.byteOffset, payloadBuffer.byteLength);
            const nextVersion = await this.computeNextVersion(input.ownerClusterId);
            const objectKey = toVtrDictObjectKey(input.ownerClusterId, nextVersion);

            await this.objectStore.putObject({
                ownerClusterId: input.ownerClusterId,
                bucket: ObjectBucketName.VtrDict,
                objectKey,
                body: Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength),
                metadata: {
                    'Content-Type': 'application/octet-stream',
                    'x-vtr-dict-version': String(nextVersion)
                }
            });

            this.cache.set(input.ownerClusterId, {
                ref: { key: objectKey, size: payload.byteLength },
                payload
            });

            logger.info(`@dictionary-trainer: trained dict for cluster=${input.ownerClusterId} version=${nextVersion} size=${payload.byteLength}`);

            return { key: objectKey, size: payload.byteLength, version: nextVersion, payload };
        });
    }

    public invalidateCache(ownerClusterId?: string): void {
        if (ownerClusterId) {
            this.cache.delete(ownerClusterId);
            return;
        }
        this.cache.clear();
    }

    private async findLatestDictKey(
        ownerClusterId: string
    ): Promise<{ objectKey: string; version: number } | null> {
        const prefix = `${ownerClusterId}/`;
        let cursor: string | undefined;
        let latest: { objectKey: string; version: number } | null = null;

        do {
            const page = await this.objectStore.list(ownerClusterId, {
                bucket: VTR_DICT_BUCKET,
                prefix,
                cursor,
                limit: 200
            });
            for (const key of page.keys) {
                const match = key.match(/\/v(\d+)\.dict$/);
                if (!match) continue;
                const version = Number(match[1]);
                if (!latest || version > latest.version) {
                    latest = { objectKey: key, version };
                }
            }
            cursor = page.nextCursor;
        } while (cursor);

        return latest;
    }

    private async computeNextVersion(ownerClusterId: string): Promise<number> {
        const latest = await this.findLatestDictKey(ownerClusterId);
        return (latest?.version ?? 0) + 1;
    }
}

const runZstd = (args: string[]): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        const child = spawn('zstd', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.once('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') {
                reject(new Error('zstd binary is not installed in the runtime image'));
                return;
            }
            reject(error);
        });
        child.once('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr.trim() || `zstd --train exited with code ${code ?? 'unknown'}`));
        });
    });
};

const streamToBuffer = async (stream: Readable): Promise<Uint8Array> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const combined = Buffer.concat(chunks);
    return new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);
};

import { Service } from '@/core/decorators/service';
import type { BlobStore } from '@/core/storage/infrastructure/BlobStore';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { toVtrObjectKey } from '@/support/serialization/storage-codec';
import type { DictionaryTrainer } from '@/modules/trajectory/application/vtr/DictionaryTrainer';
import { VtrReader, type VtrFrameData } from '@/modules/trajectory/infrastructure/codecs/vtr-reader';
import { buildVtrRemoteSource } from '@/modules/trajectory/infrastructure/codecs/vtr-object-source';
import { createHash } from 'node:crypto';

interface CachedReader {
    reader: VtrReader;
    createdAt: number;
    key: string;
}

const READER_TTL_MS = 10 * 60 * 1000;
const READER_MAX_ENTRIES = 32;
const FRAME_HASH_CACHE_MAX_ENTRIES = 1024;

export interface OpenReaderInput {
    trajectoryId: string;
    ownerClusterId: string;
}

export interface FrameHashInput extends OpenReaderInput {
    timestep: number;
}

@Service('vtrReaderRegistry')
export class VtrReaderRegistry {
    private readonly readers = new Map<string, CachedReader>();
    private readonly frameHashCache = new Map<string, string>();

    public constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly blobStore: BlobStore,
        private readonly dictionaryTrainer: DictionaryTrainer
    ) {}

    public async openReader(input: OpenReaderInput): Promise<VtrReader> {
        const key = this.buildKey(input);
        const existing = this.readers.get(key);
        if (existing && Date.now() - existing.createdAt < READER_TTL_MS) {
            this.readers.delete(key);
            this.readers.set(key, existing);
            return existing.reader;
        }

        if (existing) {
            await existing.reader.close().catch(() => {});
            this.readers.delete(key);
        }

        const objectKey = toVtrObjectKey(input.trajectoryId);
        const source = buildVtrRemoteSource({
            objectStore: this.objectStore,
            ownerClusterId: input.ownerClusterId,
            bucket: ObjectBucketName.Vtr,
            objectKey
        });

        const reader = new VtrReader({
            source,
            blobStore: this.blobStore,
            ownerClusterId: input.ownerClusterId,
            zstdDictResolver: async (ref) => {
                const resolved = await this.dictionaryTrainer.resolveLatestDict(input.ownerClusterId);
                if (!resolved) {
                    throw new Error(`vtr reader: dictionary ${ref.key} missing for cluster ${input.ownerClusterId}`);
                }
                return resolved.payload;
            }
        });
        await reader.open();

        this.readers.set(key, { reader, createdAt: Date.now(), key });
        this.evictStale();
        return reader;
    }

    public async invalidate(trajectoryId: string, ownerClusterId: string): Promise<void> {
        const key = this.buildKey({ trajectoryId, ownerClusterId });
        const cached = this.readers.get(key);
        if (!cached) return;
        await cached.reader.close().catch(() => {});
        this.readers.delete(key);
        for (const hashKey of [...this.frameHashCache.keys()]) {
            if (hashKey.startsWith(`${key}::`)) {
                this.frameHashCache.delete(hashKey);
            }
        }
    }

    public async getFrameHash(input: FrameHashInput): Promise<string> {
        const key = this.buildFrameHashKey(input);
        const cached = this.frameHashCache.get(key);
        if (cached) return cached;

        const reader = await this.openReader(input);
        const frame = await reader.readFrame(input.timestep);
        const hash = VtrReaderRegistry.hashFrame(frame);
        this.frameHashCache.set(key, hash);
        while (this.frameHashCache.size > FRAME_HASH_CACHE_MAX_ENTRIES) {
            const oldest = this.frameHashCache.keys().next().value;
            if (!oldest) break;
            this.frameHashCache.delete(oldest);
        }
        return hash;
    }

    private static hashFrame(frame: VtrFrameData): string {
        // Why: a deterministic sha256 over the normalized frame payload so the
        // ResultCache key is stable across identical inputs regardless of how
        // the frame was reconstructed (keyframe vs predictive path produce the
        // same materialized arrays).
        const hash = createHash('sha256');
        hash.update(`timestep:${frame.timestep}`);
        hash.update(`atoms:${frame.atomCount}`);
        for (const value of frame.frameBbox) {
            hash.update(` bbox:${value}`);
        }
        hash.update(Buffer.from(
            frame.positions.buffer,
            frame.positions.byteOffset,
            frame.positions.byteLength
        ));
        hash.update(Buffer.from(
            frame.types.buffer,
            frame.types.byteOffset,
            frame.types.byteLength
        ));
        if (frame.ids) {
            hash.update(Buffer.from(
                frame.ids.buffer,
                frame.ids.byteOffset,
                frame.ids.byteLength
            ));
        }
        const propertyKeys = Object.keys(frame.properties).sort();
        for (const propertyKey of propertyKeys) {
            hash.update(`prop:${propertyKey}`);
            const values = frame.properties[propertyKey];
            hash.update(Buffer.from(values.buffer, values.byteOffset, values.byteLength));
        }
        return hash.digest('hex');
    }

    private buildFrameHashKey(input: FrameHashInput): string {
        return `${this.buildKey(input)}::${input.timestep}`;
    }

    private evictStale(): void {
        const now = Date.now();
        for (const [key, cached] of this.readers) {
            if (now - cached.createdAt > READER_TTL_MS) {
                cached.reader.close().catch(() => {});
                this.readers.delete(key);
            }
        }
        while (this.readers.size > READER_MAX_ENTRIES) {
            const oldest = this.readers.keys().next().value;
            if (!oldest) break;
            const cached = this.readers.get(oldest);
            if (cached) cached.reader.close().catch(() => {});
            this.readers.delete(oldest);
        }
    }

    private buildKey(input: OpenReaderInput): string {
        return `${input.ownerClusterId}::${input.trajectoryId}`;
    }
}

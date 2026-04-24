import { Service } from '@/core/decorators/service';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { VTR_DICT_BUCKET } from '@/modules/trajectory/contracts/vtr-format';
import type { Readable } from 'node:stream';

export interface TrainerResolvedDict {
    ref: { key: string; size: number };
    payload: Uint8Array;
}

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
}

const streamToBuffer = async (stream: Readable): Promise<Uint8Array> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const combined = Buffer.concat(chunks);
    return new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);
};

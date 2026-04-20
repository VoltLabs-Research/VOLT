import { ObjectBucketName } from '@/contracts';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { createZstdDecompressionStream, isZstdObjectKey } from '@/support/serialization/storage-codec';
import headlessRasterizer from '@voltstack/headless-rasterizer';

const TRAJECTORY_PREVIEW_WIDTH = 3840;
const TRAJECTORY_PREVIEW_HEIGHT = 2160;

@Service('rasterizer')
export class Rasterizer {
    constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    async rasterizePreview(input: any): Promise<void> {
        await withNativeProcessingTempDir('trajectory-rasterize', async (tempDirectory) => {
            const tempGlbPath = path.join(tempDirectory, 'input.glb');
            const tempPngPath = path.join(tempDirectory, 'output.png');
            const inputOwnerClusterId = input.inputOwnerClusterId;
            const outputOwnerClusterId = input.outputOwnerClusterId;
            if (!inputOwnerClusterId || !outputOwnerClusterId) {
                throw new Error('Rasterization requires inputOwnerClusterId and outputOwnerClusterId');
            }

            const response = await this.objectStore.getStream(inputOwnerClusterId, input.inputBucket, input.inputObjectKey, {
                skipMetadata: true
            });
            const fileWriter = createWriteStream(tempGlbPath);
            if (isZstdObjectKey(input.inputObjectKey)) {
                const decompressed = createZstdDecompressionStream(response.stream);
                await pipeline(decompressed.stream, fileWriter);
                await decompressed.completion;
            } else {
                await pipeline(response.stream, fileWriter);
            }

            await this.rasterizeLocalGlb(tempGlbPath, tempPngPath);

            const pngStat = await fs.stat(tempPngPath);
            await this.objectStore.putObjectStream({
                ownerClusterId: outputOwnerClusterId,
                bucket: ObjectBucketName.Rasterizer,
                objectKey: input.outputObjectKey,
                stream: createReadStream(tempPngPath),
                size: pngStat.size,
                metadata: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=86400'
                }
            });
        });
    }

    async rasterizeLocalGlb(tempGlbPath: string, tempPngPath: string): Promise<void> {
        const rasterized = headlessRasterizer.rasterize(
            tempGlbPath,
            tempPngPath,
            TRAJECTORY_PREVIEW_WIDTH,
            TRAJECTORY_PREVIEW_HEIGHT,
            45,
            25,
            {
                fov: 45,
                distScale: 1,
                zUp: true
            }
        );

        if (!rasterized) {
            throw new Error('Failed to rasterize trajectory preview');
        }
    }
}

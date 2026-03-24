import { ObjectBucketName } from '@/shared/contracts';
import { logger } from '@/core/logger';
import {
    createNativeProcessingTempPath,
    NATIVE_PROCESSING_RUNTIME_DIR,
    NativeModuleOperation
} from './NativeModuleLoader';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import type { NativeModuleLoader, RasterizePreviewInput } from './NativeModuleLoader';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

export interface RasterizerService {
    rasterizePreview(input: RasterizePreviewInput): Promise<void>;
    rasterizeLocalGlb(tempGlbPath: string, tempPngPath: string): Promise<void>;
};

export const createRasterizerService = (
    objectStore: ClusterObjectStore,
    nativeModuleLoader: NativeModuleLoader
): RasterizerService => ({
    async rasterizePreview(input) {
        await fs.mkdir(NATIVE_PROCESSING_RUNTIME_DIR, {
            recursive: true
        });

        const tempGlbPath = createNativeProcessingTempPath('.glb');
        const tempPngPath = `${tempGlbPath}.png`;

        try {
            const inputOwnerClusterId = input.inputOwnerClusterId;
            const outputOwnerClusterId = input.outputOwnerClusterId;
            if (!inputOwnerClusterId || !outputOwnerClusterId) {
                throw new Error('Rasterization requires inputOwnerClusterId and outputOwnerClusterId');
            }

            const response = await objectStore.getStream(inputOwnerClusterId, input.inputBucket, input.inputObjectKey);
            const fileWriter = createWriteStream(tempGlbPath);
            await pipeline(response.stream, fileWriter);

            await this.rasterizeLocalGlb(tempGlbPath, tempPngPath);

            const pngStat = await fs.stat(tempPngPath);
            await objectStore.putObjectStream({
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
        } finally {
            await Promise.all([
                fs.unlink(tempGlbPath).catch(() => {}),
                fs.unlink(tempPngPath).catch(() => {})
            ]);
        }
    },

    async rasterizeLocalGlb(tempGlbPath, tempPngPath) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.RasterizeGlb, {
            pngPath: tempPngPath,
            tempGlbPath
        });
        const startTime = Date.now();

        logger.info(
            {
                tempGlbPath,
                tempPngPath
            },
            'Invoking native GLB rasterizer'
        );
        const rasterized = nativeModuleLoader.getRasterizerModule().rasterize(
            tempGlbPath,
            tempPngPath,
            1600,
            900,
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

        logger.info(
            {
                durationMs: Date.now() - startTime,
                tempGlbPath,
                tempPngPath
            },
            'Native GLB rasterizer completed'
        );
    }
});

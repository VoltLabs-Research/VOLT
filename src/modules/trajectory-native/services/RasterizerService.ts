import { ObjectBucketName } from '@/shared/contracts';
import { MinioService } from '@/modules/platform/services';
import {
    createNativeProcessingTempPath,
    NATIVE_PROCESSING_RUNTIME_DIR,
    NativeModuleLoader,
    type RasterizePreviewInput
} from './NativeModuleLoader';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

export interface RasterizerService {
    rasterizePreview(input: RasterizePreviewInput): Promise<void>;
    rasterizeLocalGlb(tempGlbPath: string, tempPngPath: string): Promise<void>;
};

export const createRasterizerService = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader
): RasterizerService => ({
    async rasterizePreview(input) {
        await fs.mkdir(NATIVE_PROCESSING_RUNTIME_DIR, {
            recursive: true
        });

        const tempGlbPath = createNativeProcessingTempPath('.glb');
        const tempPngPath = `${tempGlbPath}.png`;

        try {
            const stream = await minioService.getObjectStream(input.inputBucket, input.inputObjectKey);
            const fileWriter = createWriteStream(tempGlbPath);
            await pipeline(stream, fileWriter);

            await this.rasterizeLocalGlb(tempGlbPath, tempPngPath);

            const pngBuffer = await fs.readFile(tempPngPath);
            await minioService.putObject({
                bucket: ObjectBucketName.Rasterizer,
                objectKey: input.outputObjectKey,
                body: pngBuffer,
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
    }
});

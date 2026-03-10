import { ObjectBucketName } from '../../contracts/http';
import { MinioService } from '../../infrastructure/minio/MinioService';
import { NativeModuleLoader, type RasterizePreviewInput } from './NativeModuleLoader';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

export class RasterizerService {
    constructor(
        private readonly minioService: MinioService,
        private readonly nativeModuleLoader: NativeModuleLoader
    ) {
    }

    async rasterizePreview(input: RasterizePreviewInput): Promise<void> {
        const tempGlbPath = `${process.cwd()}/.runtime/native-processing/${Date.now()}-${Math.random().toString(36).slice(2)}.glb`;
        const tempPngPath = `${tempGlbPath}.png`;

        try {
            const stream = await this.minioService.getObjectStream(input.inputBucket, input.inputObjectKey);
            const fileWriter = createWriteStream(tempGlbPath);
            await pipeline(stream, fileWriter);

            await this.rasterizeLocalGlb(tempGlbPath, tempPngPath);

            const pngBuffer = await fs.readFile(tempPngPath);
            await this.minioService.putObject({
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
    }

    async rasterizeLocalGlb(tempGlbPath: string, tempPngPath: string): Promise<void> {
        const rasterized = this.nativeModuleLoader.getRasterizerModule().rasterize(
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
};

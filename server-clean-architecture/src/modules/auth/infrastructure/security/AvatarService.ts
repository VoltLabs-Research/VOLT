import { injectable, inject } from 'tsyringe';
import crypto from 'node:crypto';
import sharp from 'sharp';
import Identicon from 'identicon.js';
import logger from '@shared/infrastructure/logger';
import { IAvatarService, AvatarResult } from '@modules/auth/domain/ports/IAvatarService';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { SYS_BUCKETS } from '@core/config/minio';

@injectable()
export default class AvatarService implements IAvatarService {
    private readonly AVATAR_SIZE_PX = 420;
    private readonly COMPRESSION_QUALITY_PCT = 80;
    private readonly IDENTICON_OPTS = {
        size: 420,
        format: 'svg',
        margin: 0.08
    } as const;

    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ) { }

    generateIdenticon(seed: string): AvatarResult {
        const hash = crypto.createHash('md5').update(seed).digest('hex');
        const svgBase64 = new Identicon(hash, this.IDENTICON_OPTS).toString();
        const buffer = Buffer.from(svgBase64, 'base64');
        return {
            buffer,
            mimeType: 'image/svg+xml',
            extension: 'svg'
        };
    }

    async generateAndUploadDefaultAvatar(id: string, seed: string): Promise<string> {
        try {
            const { buffer, mimeType, extension } = this.generateIdenticon(seed);
            const fileName = `${id}_default.${extension}`;
            await this.storageService.upload(SYS_BUCKETS.AVATARS, fileName, buffer, {
                'Content-Type': mimeType
            });
            return this.storageService.getPublicURL(SYS_BUCKETS.AVATARS, fileName);
        } catch (error) {
            logger.error(`AvatarService::Default::Error generating for ${id}: ${error}`);
            throw error;
        }
    }

    async uploadCustomAvatar(id: string, inputBuffer: Buffer): Promise<string> {
        try {
            const processedBuffer = await sharp(inputBuffer)
                .resize(this.AVATAR_SIZE_PX, this.AVATAR_SIZE_PX, {
                    fit: 'cover',
                    withoutEnlargement: true
                })
                .webp({ quality: this.COMPRESSION_QUALITY_PCT })
                .toBuffer();

            const fileName = `${id}_${Date.now()}.webp`;
            await this.storageService.upload(SYS_BUCKETS.AVATARS, fileName, processedBuffer, {
                'Content-Type': 'image/webp'
            });
            return this.storageService.getPublicURL(SYS_BUCKETS.AVATARS, fileName);
        } catch (error) {
            logger.error(`AvatarService::Custom::Error uploading for ${id}: ${error}`);
            throw error;
        }
    }
}

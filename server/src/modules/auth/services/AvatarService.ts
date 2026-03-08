import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import crypto from 'node:crypto';
import Identicon from 'identicon.js';
import sharp from 'sharp';
import type { AvatarResult, IAvatarService } from '@modules/auth/domain/port/IAvatarService';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { IdenticonOptions } from 'identicon.js';

interface LoggerErrorContext {
    err: unknown;
    operation: string;
    id: string;
}

@injectable()
export default class AvatarService implements IAvatarService {
    private readonly AVATAR_SIZE_PX = 420;
    private readonly COMPRESSION_QUALITY_PCT = 80;
    private readonly IDENTICON_OPTS: IdenticonOptions = {
        size: 420,
        format: 'svg',
        margin: 0.08
    };

    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ) {}

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
            logger.error({
                err: error,
                operation: 'generate-default-avatar',
                id
            } satisfies LoggerErrorContext, 'AvatarService::Default::Error generating avatar');
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
            logger.error({
                err: error,
                operation: 'upload-custom-avatar',
                id
            } satisfies LoggerErrorContext, 'AvatarService::Custom::Error uploading avatar');
            throw error;
        }
    }
}

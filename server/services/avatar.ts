import { SYS_BUCKETS } from '@/config/minio';
import storage from '@/services/storage';
import crypto from 'node:crypto';
import sharp from 'sharp';
import Identicon from 'identicon.js';
import logger from '@/logger';

export interface AvatarResult{
    buffer: Buffer;
    mimeType: string;
    extension: string;
};

export class AvatarService{
    private static readonly AVATAR_SIZE_PX = 420;
    private static readonly COMPRESSION_QUALITY_PCT = 80;
    private static readonly IDENTICON_OPTS = {
        size: 420,
        format: 'svg',
        margin: 0.08
    } as const;

    public static generateIdenticon(seed: string): AvatarResult{
        const hash = crypto.createHash('md5').update(seed).digest('hex');
        const svgBase64 = new Identicon(hash, this.IDENTICON_OPTS).toString();
        const buffer = Buffer.from(svgBase64, 'base64');
        return {
            buffer,
            mimeType: 'image/svg+xml',
            extension: 'svg'
        };
    }

    public static async generateAndUploadDefaultAvatar(userId: string, seed: string): Promise<string>{
        try{
            const { buffer, mimeType, extension } = this.generateIdenticon(seed);
            const fileName = `${userId}_default.${extension}`;
            await storage.put(SYS_BUCKETS.AVATARS, fileName, buffer, {
                'Content-Type': mimeType
            });
            return storage.getPublicURL(SYS_BUCKETS.AVATARS, fileName);
        }catch(error){
            logger.error(`AvatarService::Default::Error generating for ${userId}: ${error}`);
            throw error;
        }
    }

    public static async uploadCustomAvatar(userId: string, inputBuffer: Buffer): Promise<string>{
        try{
            const processedBuffer = await sharp(inputBuffer)
                .resize(this.AVATAR_SIZE_PX, this.AVATAR_SIZE_PX, {
                    // smart center cut
                    fit: 'cover',
                    // do not stretch small images
                    withoutEnlargement: true
                })
                .webp({ quality: this.COMPRESSION_QUALITY_PCT })
                .toBuffer();

            // Generate name with timestamp for cache busting and upload
            const fileName = `${userId}_${Date.now()}.webp`;
            await storage.put(SYS_BUCKETS.AVATARS, fileName, processedBuffer, {
                'Content-Type': 'image/webp'
            });
            return storage.getPublicURL(SYS_BUCKETS.AVATARS, fileName);
        }catch(error){
            logger.error(`AvatarService::Custom::Error uploading for ${userId}: ${error}`);
            throw error;
        }
    }
};
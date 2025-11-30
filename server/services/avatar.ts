import crypto from 'crypto';
import Identicon from 'identicon.js';
import { SYS_BUCKETS, uploadFile, getFileUrl } from '@config/minio';
import logger from '@/logger';

export class AvatarService {
    /**
     * Generate a GitHub-style identicon based on a string (e.g. email)
     * @param seed String to seed the generation (usually email or username)
     * @returns Object containing the buffer and mime type
     */
    public static generateIdenticon(seed: string): { buffer: Buffer, mimeType: string } {
        // Create a hash from the seed
        const hash = crypto.createHash('md5').update(seed).digest('hex');

        // Generate identicon (size 420px, margin 0.08)
        // format: 'png' or 'svg'
        const data = new Identicon(hash, {
            size: 420,
            format: 'png',
            margin: 0.08
        }).toString();

        // Convert base64 to buffer
        const buffer = Buffer.from(data, 'base64');

        return {
            buffer,
            mimeType: 'image/png'
        };
    }

    /**
     * Generate and upload a default avatar for a user
     * @param userId User ID
     * @param seed Seed string (email)
     * @returns Public URL of the uploaded avatar
     */
    public static async generateAndUploadDefaultAvatar(userId: string, seed: string): Promise<string> {
        try {
            const { buffer, mimeType } = this.generateIdenticon(seed);
            const fileName = `${userId}_default.png`;

            await uploadFile(
                SYS_BUCKETS.AVATARS,
                fileName,
                buffer,
                mimeType
            );

            return getFileUrl(SYS_BUCKETS.AVATARS, fileName);
        } catch (error) {
            logger.error(`Failed to generate default avatar for user ${userId}: ${error}`);
            throw error;
        }
    }

    /**
     * Upload a custom avatar for a user
     * @param userId User ID
     * @param buffer Image buffer
     * @param mimeType Image mime type
     * @returns Public URL of the uploaded avatar
     */
    public static async uploadCustomAvatar(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
        try {
            // Generate a unique filename to avoid caching issues
            const timestamp = Date.now();
            const extension = mimeType.split('/')[1] || 'png';
            const fileName = `${userId}_${timestamp}.${extension}`;

            await uploadFile(
                SYS_BUCKETS.AVATARS,
                fileName,
                buffer,
                mimeType
            );

            return getFileUrl(SYS_BUCKETS.AVATARS, fileName);
        } catch (error) {
            logger.error(`Failed to upload custom avatar for user ${userId}: ${error}`);
            throw error;
        }
    }
}

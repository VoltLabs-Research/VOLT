import { Client } from 'minio';
import logger from '@shared/infrastructure/logger';

let minioClient: Client | null = null;

export const SYS_BUCKETS = {
    MODELS: 'opendxa-models',
    RASTERIZER: 'opendxa-rasterizer',
    PLUGINS: 'opendxa-plugins',
    DUMPS: 'opendxa-dumps',
    AVATARS: 'opendxa-avatars',
    CHAT: 'opendxa-chat'
};

export const getMinioConfig = () => {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = Number(process.env.MINIO_PORT ?? 9000);
    const useSSL = process.env.MINIO_USE_SSL === 'true';

    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;

    return { endPoint, port, useSSL, accessKey, secretKey };

};

const createClient = (): Client => {
    const { endPoint, accessKey, port, secretKey, useSSL } = getMinioConfig();

    // CORE-007: Validate credentials early with clear English error message
    if (!accessKey || !secretKey) {
        throw new Error('[MinIO] MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set in environment variables');
    }

    return new Client({
        endPoint,
        port,
        useSSL,
        accessKey,
        secretKey
    });
};

export const getMinioClient = (): Client => {
    if (!minioClient) {
        minioClient = createClient();
    }
    return minioClient;
};

export const ensureBucketExists = async (client: Client, bucket: string): Promise<void> => {
    // CORE-017: Don't swallow errors silently, log them
    const exists = await client.bucketExists(bucket).catch((err) => {
        logger.warn('Error checking bucket existence:', err);
        return false;
    });
    if (!exists) {
        await client.makeBucket(bucket, '');
        // Set public policy for avatars bucket
        if (bucket === SYS_BUCKETS.AVATARS) {
            const policy = {
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Principal: '*',
                    Action: ['s3:GetObject'],
                    Resource: [`arn:aws:s3:::${bucket}/*`]
                }]
            };
            await client.setBucketPolicy(bucket, JSON.stringify(policy));
        }
        logger.info(`[MinIO] OK: ${bucket}`);
    }
};

// CORE-006: Wrap bucket creation loop in try/catch per bucket
export const initializeMinio = async (): Promise<void> => {
    const client = getMinioClient();
    const buckets = Object.values(SYS_BUCKETS);
    for (const bucket of buckets) {
        try {
            await ensureBucketExists(client, bucket);
        } catch (error) {
            logger.error(`Failed to ensure bucket ${bucket}:`, error);
            throw error;
        }
    }
    logger.info('[MinIO] Complete initialization');
};

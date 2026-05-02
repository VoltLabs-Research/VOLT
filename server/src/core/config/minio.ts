import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import logger from '@shared/infrastructure/logger';
import { Client } from 'minio';

export interface MinioClientConfig {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey?: string;
    secretKey?: string;
    publicUrl?: string;
}

let minioClient: Client | null = null;

export const SYS_BUCKETS = {
    MODELS: 'volt-models',
    RASTERIZER: 'volt-rasterizer',
    PLUGINS: 'volt-plugins',
    ANALYSIS_LOGS: 'volt-analysis-logs',
    DUMPS: 'volt-dumps',
    AVATARS: 'volt-avatars',
    CHAT: 'volt-chat',
    WHITEBOARDS: 'volt-whiteboards',
    LATEX_ASSETS: 'volt-latex-assets'
};

export const getMinioConfig = (): MinioClientConfig => {
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    return {
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: readNumberEnv('MINIO_PORT', useSSL ? 443 : 9000),
        useSSL,
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY,
        publicUrl: process.env.MINIO_PUBLIC_URL
    };
};

export const createMinioClient = (config: MinioClientConfig): Client => {
    const { endPoint, accessKey, port, secretKey, useSSL } = config;

    if (!accessKey || !secretKey) {
        throw new Error('[MinIO] MINIO_ACCESS_KEY o MINIO_SECRET_KEY not in .env');
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
        minioClient = createMinioClient(getMinioConfig());
    }
    return minioClient;
};

const ensureBucketExists = async (client: Client, bucket: string): Promise<void> => {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if (!exists) {
        await client.makeBucket(bucket, '');
        // Set public policy for avatars bucket
        if (bucket === SYS_BUCKETS.AVATARS || bucket === SYS_BUCKETS.CHAT || bucket === SYS_BUCKETS.LATEX_ASSETS) {
            const policy = {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: '*',
                        Action: ['s3:GetObject'],
                        Resource: [`arn:aws:s3:::${bucket}/*`]
                    }
                ]
            };
            await client.setBucketPolicy(bucket, JSON.stringify(policy));
        }
        logger.info(`[MinIO] OK: ${bucket}`);
    }
};

export const initializeMinio = async (): Promise<void> => {
    const client = getMinioClient();
    const buckets = Object.values(SYS_BUCKETS);
    for (const bucket of buckets) {
        await ensureBucketExists(client, bucket);
    }
    logger.info('[MinIO] Complete initialization');
};

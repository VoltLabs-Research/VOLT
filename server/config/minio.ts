import { Client } from 'minio';
import logger from '@/logger';

let minioClient: Client | null = null;

export const SYS_BUCKETS = {
    MODELS: 'opendxa-models',
    RASTERIZER: 'opendxa-rasterizer',
    PLUGINS: 'opendxa-plugins',
    DUMPS: 'opendxa-dumps',
    AVATARS: 'opendxa-avatars'
};

const createClient = (): Client => {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = Number(process.env.MINIO_PORT ?? 9000);
    const useSSL = process.env.MINIO_USE_SSL === 'true';

    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;

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
        minioClient = createClient();
    }
    return minioClient;
};

export const ensureBucketExists = async (client: Client, bucket: string): Promise<void> => {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if (!exists) {
        await client.makeBucket(bucket, '');
        // Set public policy for avatars bucket
        if (bucket === SYS_BUCKETS.AVATARS) {
            const policy = {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: { AWS: ['*'] },
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

export const putObject = async (bucketName: string, objectName: string, payload: any): Promise<void> => {
    const client = getMinioClient();
    const body = Buffer.from(JSON.stringify(payload), 'utf-8');
    await client.putObject(
        bucketName,
        objectName,
        body,
        body.length,
        { 'Content-Type': 'application/json' }
    );
};

export const uploadFile = async (bucketName: string, objectName: string, buffer: Buffer, contentType: string): Promise<void> => {
    const client = getMinioClient();
    await client.putObject(
        bucketName,
        objectName,
        buffer,
        buffer.length,
        { 'Content-Type': contentType }
    );
};

export const getFileUrl = (bucketName: string, objectName: string): string => {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT ?? 9000;
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    return `${protocol}://${endPoint}:${port}/${bucketName}/${objectName}`;
};

export const initializeMinio = async (): Promise<void> => {
    const client = getMinioClient();
    const buckets = Object.values(SYS_BUCKETS);
    for (const bucket of buckets) {
        await ensureBucketExists(client, bucket);
    }
    logger.info('[MinIO] Complete initialization');
};

export const getJSONFromBucket = async<T = any>(bucket: string, objectName: string): Promise<T> => {
    const client = getMinioClient();
    const stream = await client.getObject(bucket, objectName);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return JSON.parse(buffer.toString('utf-8')) as T;
};
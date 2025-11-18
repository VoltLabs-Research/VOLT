import { Client } from 'minio';

let minioClient: Client | null = null;

const createClient = (): Client => {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = Number(process.env.MINIO_PORT ?? 9000);
    const useSSL = process.env.MINIO_USE_SSL === 'true';

    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;

    if(!accessKey || !secretKey){
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
    if(!minioClient){
        minioClient = createClient();
    }
    return minioClient;
};

const ensureBucketExists = async (client: Client, bucket: string): Promise<void> => {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if(!exists){
        await client.makeBucket(bucket, '');
        console.log(`[MinIO] OK: ${bucket}`);
    }
};

export const initializeMinio = async (): Promise<void> => {
    const client = getMinioClient();
    const buckets = ['elastic-strain', 'atomic-strain', 'dislocations'];
    for(const bucket of buckets){
        await ensureBucketExists(client, bucket);
    }
    console.log('[MinIO] Complete initialization');
}
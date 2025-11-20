import { Client } from 'minio';

let minioClient: Client | null = null;

export const SYS_BUCKETS = {
    MODELS: 'opendxa-models',
    RASTERIZER: 'opendxa-rasterizer',
    PLUGINS: 'opendxa-plugins'
};

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

export const ensureBucketExists = async (client: Client, bucket: string): Promise<void> => {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if(!exists){
        await client.makeBucket(bucket, '');
        console.log(`[MinIO] OK: ${bucket}`);
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

export const initializeMinio = async (): Promise<void> => {
    const client = getMinioClient();
    const buckets = Object.values(SYS_BUCKETS);
    for(const bucket of buckets){
        await ensureBucketExists(client, bucket);
    }
    console.log('[MinIO] Complete initialization');
};

export const getJSONFromBucket = async<T = any>(bucket: string, objectName: string): Promise<T> => {
    const client = getMinioClient();
    const stream = await client.getObject(bucket, objectName);
    const chunks: Buffer[] = [];
    for await(const chunk of stream){
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return JSON.parse(buffer.toString('utf-8')) as T;
};
import 'dotenv/config';
import { Client } from 'minio';

const dropAllBuckets = async (): Promise<void> => {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = Number(process.env.MINIO_PORT ?? 9000);
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;

    if (!accessKey || !secretKey) {
        console.error('[MinIO] MINIO_ACCESS_KEY or MINIO_SECRET_KEY not in .env');
        process.exit(1);
    }

    const client = new Client({ endPoint, port, useSSL, accessKey, secretKey });

    console.log('[MinIO] Fetching all buckets...');
    const buckets = await client.listBuckets();

    if (buckets.length === 0) {
        console.log('[MinIO] No buckets found.');
        return;
    }

    for (const bucket of buckets) {
        console.log(`[MinIO] Deleting bucket: ${bucket.name}`);

        const objectsStream = client.listObjects(bucket.name, '', true);
        const objects: string[] = [];

        for await (const obj of objectsStream) {
            objects.push(obj.name);
        }

        if (objects.length > 0) {
            await client.removeObjects(bucket.name, objects);
            console.log(`[MinIO] Removed ${objects.length} objects from ${bucket.name}`);
        }

        await client.removeBucket(bucket.name);
        console.log(`[MinIO] Bucket ${bucket.name} deleted.`);
    }

    console.log('[MinIO] All buckets deleted successfully.');
};

dropAllBuckets()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[MinIO] Error:', err);
        process.exit(1);
    });

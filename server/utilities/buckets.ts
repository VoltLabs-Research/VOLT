import { getMinioClient } from '@/config/minio';
import logger from '@/logger';
import { ReadStream } from 'fs';
import { stat, writeFile } from 'fs/promises';
import { BucketItemStat, ItemBucketMetadata } from 'minio';
import { Readable } from 'stream';

type PutObjectData = Buffer | Readable;

export const putObject = async (
    objectName: string, 
    bucketName: string, 
    data: PutObjectData, 
    metadata: ItemBucketMetadata
): Promise<void> => {
    const client = getMinioClient();

    if(Buffer.isBuffer(data)){
        await client.putObject(
            bucketName,
            objectName,
            data,
            data.length,
            metadata
        );
        return;
    }

    let size = -1;
    const readStream = data as ReadStream & { path?: string };
    if(readStream.path && typeof readStream.path === 'string'){
        try{
            const st = await stat(readStream.path);
            size = st.size;
        }catch{
            size = -1;
        }
    }

    await client.putObject(
        bucketName,
        objectName,
        data,
        size,
        metadata
    );
};

export const getObject = async (objectName: string, bucketName: string): Promise<Buffer> => {
    const client = getMinioClient();
    const stream = await client.getObject(bucketName, objectName);
    const chunks: Buffer[] = [];
    for await(const chunk of stream){
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
};

export const getStream = async (objectName: string, bucketName: string): Promise<Readable> => {
    const client = getMinioClient();
    return await client.getObject(bucketName, objectName);
};

export const statObject = async (objectName: string, bucketName: string): Promise<BucketItemStat> => {
    const client = getMinioClient();
    return await client.statObject(bucketName, objectName);
};

export const listByPrefix = async (prefix: string, bucketName: string): Promise<string[]> => {
    const client = getMinioClient();
    const result: string[] = [];
    const stream = client.listObjectsV2(bucketName, prefix, true);
    for await(const obj of stream){
        if(obj.name) result.push(obj.name);
    }
    return result;
};

export const objectExists = async (objectName: string, bucketName: string): Promise<boolean> => {
    try{
        await statObject(objectName, bucketName);
        return true;
    }catch{
        return false;
    }
};

export const deleteObject = async (objectName: string, bucketName: string): Promise<void> => {
    const client = getMinioClient();
    await client.removeObject(bucketName, objectName);
};

export const downloadObject = async (objectName: string, bucketName: string, path: string) => {
    const buffer = await getObject(objectName, bucketName);
    await writeFile(path, buffer);
};

export const deleteByPrefix = async (bucket: string, prefix: string): Promise<void> => {
    const client = getMinioClient();
    const stream = client.listObjectsV2(bucket, prefix, true);
    const keys: string[] = [];

    await new Promise<void>((resolve, reject) => {
        stream.on('data', (obj: any) => {
            if(obj.name) keys.push(obj.name); 
        });

        stream.on('error', (err: any) => {
            reject(err);
        });

        stream.on('end', () => resolve());
    });

    if(keys.length === 0) return;

    // TODO: Promise.all(...)
    const chunkSize = 1000;
    for(let i = 0; i < keys.length; i += chunkSize){
        const slice = keys.slice(i, i + chunkSize);
        logger.info(`[deleteByPrefix] Deleting ${slice.length} objects in bucket "${bucket}"...`);
        await client.removeObjects(bucket, slice);
    }
};
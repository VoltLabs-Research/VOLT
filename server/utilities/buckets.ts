import { getMinioClient } from '@/config/minio';
import { writeFile } from 'fs/promises';
import { BucketItemStat, ItemBucketMetadata } from 'minio';
import { Readable } from 'stream';

export const putObject = async (
    objectName: string, 
    bucketName: string, 
    buffer: Buffer, 
    metadata: ItemBucketMetadata
): Promise<void> => {
    const client = getMinioClient();
    await client.putObject(
        bucketName,
        objectName,
        buffer,
        buffer.length,
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
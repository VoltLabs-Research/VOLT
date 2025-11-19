import { getMinioClient } from "@/config/minio";
import { Readable } from 'stream';

/**
 * Uploads a GLB file to MinIO.
 * Path format: {trajectoryId}/previews/glb/{frame}.glb
 *              {trajectoryId}/{analysisId}/glb/{frame}/{type}.glb
 */
export const putGLBObject = async (objectName: string, buffer: Buffer): Promise<void> => {
    const client = getMinioClient();
    await client.putObject(
        'glbs',
        objectName,
        buffer,
        buffer.length,
        { 'Content-Type': 'model/gltf-binary' }
    );
};

/**
 * Downloads a GLB file from MinIO as a Buffer.
 */
export const getGLBObject = async (objectName: string): Promise<Buffer> => {
    const client = getMinioClient();
    const stream = await client.getObject('glbs', objectName);
    const chunks: Buffer[] = [];
    for await(const chunk of stream){
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
};

/**
 * Gets a readable stream for a GLB file from MinIO.
 */
export const getGLBStream = async (objectName: string): Promise<Readable> => {
    const client = getMinioClient();
    return await client.getObject('glbs', objectName);
};

/**
 * Gets stat info for a GLB object (size, etag, lastModified).
 */
export const statGLBObject = async (objectName: string): Promise<{ size: number; etag: string; lastModified: Date }> => {
    const client = getMinioClient();
    const stat = await client.statObject('glbs', objectName);
    return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified
    };
};

/**
 * Lists GLB objects by prefix.
 * Returns array of object names (keys).
 */
export const listGLBsByPrefix = async (prefix: string): Promise<string[]> => {
    const client = getMinioClient();
    const result: string[] = [];

    const stream = client.listObjectsV2('glbs', prefix, true);
    for await(const obj of stream as any){
        if(obj.name){
            result.push(obj.name);
        }
    }
    
    return result;
};

/**
 * Checks if a GLB object exists in MinIO.
 */
export const glbObjectExists = async (objectName: string): Promise<boolean> => {
    try{
        await statGLBObject(objectName);
        return true;
    }catch{
        return false;
    }
};

/**
 * Deletes a GLB object from MinIO.
 */
export const deleteGLBObject = async (objectName: string): Promise<void> => {
    const client = getMinioClient();
    await client.removeObject('glbs', objectName);
};

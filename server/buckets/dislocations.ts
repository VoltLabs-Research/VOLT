import { getMinioClient } from "@/config/minio";

export const putDislocationsObject = async (objectName: string, payload: any): Promise<void> => {
    const client = getMinioClient();
    const body = Buffer.from(JSON.stringify(payload), 'utf-8');
    await client.putObject(
        'dislocations',
        objectName,
        body,
        body.length,
        { 'Content-Type': 'application/json' }
    );
};

export const getDislocationsObject = async (objectName: string): Promise<any> => {
    const client = getMinioClient();
    const stream = await client.getObject('dislocations', objectName);
    const chunks: Buffer[] = [];
    for await(const chunk of stream){
        chunks.push(chunk as Buffer);
    }
    const buf = Buffer.concat(chunks);
    return JSON.parse(buf.toString('utf-8'));
};

export const listDislocationsByPrefix = async (
    prefix: string
): Promise<Array<{ key: string, data: any }>> => {
    const client = getMinioClient();
    const result: Array<{ key: string; data: any }> = [];

    const stream = client.listObjectsV2('dislocations', prefix, true);
    for await(const obj of stream as any){
        if(!obj.name) continue;
        const data = await getDislocationsObject(obj.name);
        result.push({ key: obj.name, data });
    }
    
    return result;
};